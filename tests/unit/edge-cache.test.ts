import { afterEach, describe, expect, it } from 'vitest';
import { readEdgeCache, writeEdgeCache } from '@/server/edge-cache';
import { CACHE } from '@/server/security-headers';

/** Cache API simulada (como `caches.default` do Cloudflare). */
function installFakeCache() {
  const store = new Map<string, Response>();
  (globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (req: Request) => store.get(req.url)?.clone(),
      put: async (req: Request, res: Response) => {
        store.set(req.url, res);
      },
    },
  };
  return store;
}

const page = (cacheControl: string = CACHE.publicPage) =>
  new Response('<html>ok</html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cacheControl },
  });

async function flush(pending: Promise<unknown>[]) {
  await Promise.all(pending);
}

describe('cache de borda (Cloudflare Cache API)', () => {
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches;
  });

  it('sem Cache API (Node/Vercel) não faz nada', async () => {
    const url = new URL('https://mm.test/estoque');
    const request = new Request(url);
    writeEdgeCache(request, url, page(), () => undefined);
    expect(await readEdgeCache(request, url)).toBeNull();
  });

  it('guarda página pública e devolve sem cache no navegador', async () => {
    const store = installFakeCache();
    const url = new URL('https://mm.test/estoque?marca=Toyota');
    const request = new Request(url, { headers: { Cookie: 'mm_admin=x' } });
    const pending: Promise<unknown>[] = [];
    writeEdgeCache(request, url, page(), (p) => pending.push(p));
    await flush(pending);
    expect(store.get(url.toString())?.headers.get('Cache-Control')).toBe('public, max-age=60');

    const hit = await readEdgeCache(new Request(url), url);
    expect(await hit?.text()).toBe('<html>ok</html>');
    expect(hit?.headers.get('Cache-Control')).toBe(CACHE.publicPage);
  });

  it('nunca guarda painel, APIs, fotos, POST ou respostas privadas', async () => {
    const store = installFakeCache();
    const pending: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => pending.push(p);
    for (const path of ['/admin', '/admin/veiculos', '/api/leads', '/media/vehicles/a/b.webp', '/og/veiculo/a/b.jpg']) {
      const url = new URL(`https://mm.test${path}`);
      writeEdgeCache(new Request(url), url, page(), waitUntil);
    }
    const home = new URL('https://mm.test/');
    writeEdgeCache(new Request(home, { method: 'POST' }), home, page(), waitUntil);
    writeEdgeCache(new Request(home), home, page(CACHE.noStore), waitUntil);
    await flush(pending);
    expect(store.size).toBe(0);
  });
});
