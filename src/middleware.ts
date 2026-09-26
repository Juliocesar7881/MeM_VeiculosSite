import { defineMiddleware } from 'astro:middleware';
import { authenticateAdmin } from '@/server/admin-auth';
import { canonicalRedirect } from '@/server/canonical';
import { getContainer } from '@/server/container';
import { readEdgeCache, writeEdgeCache } from '@/server/edge-cache';
import { applySecurityHeaders, CACHE } from '@/server/security-headers';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** Proteção CSRF: requisições que alteram dados devem vir do próprio site. */
function isSameOrigin(request: Request, url: URL, allowedOrigins: string[]): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin || allowedOrigins.includes(origin);
  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite === 'same-origin';
}

function unavailable(): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>M&amp;M Veículos</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08090a;color:#f4f4f4;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}h1{color:#f2c12e;font-size:1.4rem}</style></head><body><main><h1>Voltamos em instantes</h1><p>Estamos realizando uma manutenção rápida. Tente novamente em alguns minutos.</p></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '120', 'Cache-Control': CACHE.noStore },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, cookies } = context;
  const pathname = url.pathname;
  const adminPage = isAdminPath(pathname);
  const adminApi = pathname.startsWith('/api/admin/');
  const isLogin = pathname === '/admin/login';

  // Cloudflare (domínio próprio): página pública recente servida da borda, sem tocar no banco.
  const cached = await readEdgeCache(request, url);
  if (cached) return cached;

  let container;
  try {
    container = await getContainer(url.origin);
  } catch (error) {
    console.error('[middleware] falha ao inicializar dependências', error);
    return unavailable();
  }
  const { config } = container;
  context.locals.container = container;
  context.locals.siteUrl = config.siteUrl ?? url.origin;

  const handle = async (): Promise<Response> => {
    const redirect = canonicalRedirect(request, url, config.siteUrl, {
      upgradeHttp: container.platform.name === 'cloudflare',
    });
    if (redirect) return redirect;

    if (!SAFE_METHODS.has(request.method) && (adminPage || pathname.startsWith('/api/'))) {
      const allowed = config.siteUrl ? [config.siteUrl] : [];
      if (!isSameOrigin(request, url, allowed)) {
        return new Response('Origem da requisição não permitida.', { status: 403 });
      }
    }

    if ((adminPage && !isLogin) || adminApi) {
      const actor = await authenticateAdmin(request, cookies, config, () => container.settings.sessionsValidAfter());
      if (!actor) {
        if (adminApi) {
          return new Response(JSON.stringify({ ok: false, error: 'Sessão expirada. Entre novamente.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          });
        }
        if (config.auth.mode === 'cloudflare-access') {
          return new Response('Acesso restrito.', { status: 403 });
        }
        const nextPath = `${pathname}${url.search}`;
        return new Response(null, {
          status: 303,
          headers: { Location: `/admin/login?next=${encodeURIComponent(nextPath)}` },
        });
      }
      context.locals.admin = actor;
    }
    return next();
  };

  const original = await handle();
  // Cópia com headers mutáveis (respostas de redirect têm headers imutáveis).
  // Todas as respostas — inclusive bloqueios e redirecionamentos — recebem os headers de segurança.
  const response = new Response(original.body, original);
  const isPrivate = adminPage || adminApi;

  applySecurityHeaders(response.headers, {
    isProduction: config.isProduction,
    isHttps: url.protocol === 'https:',
    noIndex: isPrivate || pathname.startsWith('/api/') || !config.allowIndexing,
  });

  if (isPrivate) {
    response.headers.set('Cache-Control', CACHE.noStore);
  } else if (
    !response.headers.has('Cache-Control') &&
    request.method === 'GET' &&
    response.status === 200 &&
    !response.headers.has('Set-Cookie') &&
    (response.headers.get('Content-Type') ?? '').includes('text/html')
  ) {
    response.headers.set('Cache-Control', CACHE.publicPage);
  } else if (!response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', CACHE.noStore);
  }
  if (!isPrivate) {
    const cf = context.locals.cfContext;
    writeEdgeCache(request, url, response, cf ? (promise) => cf.waitUntil(promise) : undefined);
  }
  return response;
});
