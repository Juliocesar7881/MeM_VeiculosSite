import { CACHE } from './security-headers';

/**
 * Cache de borda do Cloudflare (Cache API) para páginas públicas.
 *
 * No Workers a CDN não guarda respostas geradas pelo Worker; este cache faz esse papel: a página
 * fica 60 s no data center que atendeu o visitante e é servida sem consultar o banco.
 * - Só funciona em domínio próprio: em *.workers.dev a Cloudflare ignora a Cache API.
 * - Em Node/Vercel não existe `caches.default` e nada acontece (lá a CDN já respeita o s-maxage).
 * - Só entram respostas marcadas como página pública (GET 200 HTML, sem Set-Cookie) — ver middleware.
 */
export const EDGE_CACHE_SECONDS = 60;

interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function edgeCache(): EdgeCache | null {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null;
}

/** Rotas que nunca são páginas públicas cacheáveis (evita consultas inúteis ao cache). */
function isCandidate(request: Request, url: URL): boolean {
  if (request.method !== 'GET') return false;
  const path = url.pathname;
  return !(
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/api/') ||
    path.startsWith('/media/') ||
    path.startsWith('/og/')
  );
}

/** A chave ignora headers da requisição (cookies etc.): páginas públicas são iguais para todos. */
function cacheKey(url: URL): Request {
  return new Request(url.toString(), { method: 'GET' });
}

export async function readEdgeCache(request: Request, url: URL): Promise<Response | null> {
  const cache = edgeCache();
  if (!cache || !isCandidate(request, url)) return null;
  try {
    const hit = await cache.match(cacheKey(url));
    if (!hit) return null;
    const response = new Response(hit.body, hit);
    // No navegador continua sem cache (max-age=0): o visitante sempre recebe a versão da borda.
    response.headers.set('Cache-Control', CACHE.publicPage);
    return response;
  } catch {
    return null;
  }
}

export function writeEdgeCache(
  request: Request,
  url: URL,
  response: Response,
  waitUntil: ((promise: Promise<unknown>) => void) | undefined,
): void {
  const cache = edgeCache();
  if (!cache || !waitUntil || !isCandidate(request, url)) return;
  if (response.headers.get('Cache-Control') !== CACHE.publicPage) return;
  const stored = new Response(response.clone().body, response);
  stored.headers.set('Cache-Control', `public, max-age=${EDGE_CACHE_SECONDS}`);
  waitUntil(cache.put(cacheKey(url), stored).catch(() => undefined));
}
