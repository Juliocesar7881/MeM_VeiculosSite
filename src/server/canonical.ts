/**
 * Endereço único do site: com o domínio definido em PUBLIC_SITE_URL, acessos por outros endereços
 * (domínio sem "www", URL *.workers.dev, etc.) recebem 301 para o endereço oficial — bom para o
 * Google (sem conteúdo duplicado) e dispensa regras de redirecionamento no painel da Cloudflare.
 * Só GET/HEAD são redirecionados; localhost fica de fora (desenvolvimento e testes).
 */
export function canonicalRedirect(request: Request, url: URL, siteUrl: string | null): Response | null {
  if (!siteUrl || (request.method !== 'GET' && request.method !== 'HEAD')) return null;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return null;
  let canonical: URL;
  try {
    canonical = new URL(siteUrl);
  } catch {
    return null;
  }
  if (url.host === canonical.host) return null;
  return new Response(null, {
    status: 301,
    // Cache curto: se o domínio for configurado errado, os navegadores não ficam presos no redirecionamento.
    headers: { Location: `${canonical.origin}${url.pathname}${url.search}`, 'Cache-Control': 'public, max-age=300' },
  });
}
