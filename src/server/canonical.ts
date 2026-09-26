/**
 * Endereço único do site: com o domínio definido em PUBLIC_SITE_URL, acessos por outros endereços
 * (domínio sem "www", URL *.workers.dev, etc.) recebem 301 para o endereço oficial — bom para o
 * Google (sem conteúdo duplicado) e dispensa regras de redirecionamento no painel da Cloudflare.
 * Só GET/HEAD são redirecionados; localhost fica de fora (desenvolvimento e testes).
 *
 * `upgradeHttp`: também leva http:// para https:// no próprio domínio. Só no Cloudflare, onde a URL
 * recebida pelo Worker tem o protocolo real do visitante (atrás de outros proxies ela pode vir como
 * http mesmo com cadeado, e o redirecionamento viraria um laço).
 */
export function canonicalRedirect(
  request: Request,
  url: URL,
  siteUrl: string | null,
  options: { upgradeHttp?: boolean } = {},
): Response | null {
  if (!siteUrl || (request.method !== 'GET' && request.method !== 'HEAD')) return null;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return null;
  let canonical: URL;
  try {
    canonical = new URL(siteUrl);
  } catch {
    return null;
  }
  const insecure = options.upgradeHttp === true && url.protocol === 'http:' && canonical.protocol === 'https:';
  if (url.host === canonical.host && !insecure) return null;
  return new Response(null, {
    status: 301,
    // Cache curto: se o domínio for configurado errado, os navegadores não ficam presos no redirecionamento.
    headers: { Location: `${canonical.origin}${url.pathname}${url.search}`, 'Cache-Control': 'public, max-age=300' },
  });
}
