import { describe, expect, it } from 'vitest';
import { canonicalRedirect } from '@/server/canonical';

const SITE = 'https://www.mmveiculos.com.br';

function check(href: string, method = 'GET', siteUrl: string | null = SITE, upgradeHttp = false) {
  const url = new URL(href);
  return canonicalRedirect(new Request(url, { method }), url, siteUrl, { upgradeHttp });
}

describe('redirecionamento para o endereço oficial', () => {
  it('domínio sem www e URL workers.dev vão para o www (301, mantendo caminho e busca)', () => {
    for (const host of ['https://mmveiculos.com.br', 'https://mm-veiculos.lupinho7881.workers.dev']) {
      const res = check(`${host}/veiculos?marca=Toyota`);
      expect(res?.status).toBe(301);
      expect(res?.headers.get('Location')).toBe(`${SITE}/veiculos?marca=Toyota`);
    }
  });

  it('http:// vai para https:// (no Cloudflare), sem laço no endereço oficial', () => {
    for (const host of ['http://www.mmveiculos.com.br', 'http://mmveiculos.com.br']) {
      const res = check(`${host}/veiculo/x?a=1`, 'GET', SITE, true);
      expect(res?.status).toBe(301);
      expect(res?.headers.get('Location')).toBe(`${SITE}/veiculo/x?a=1`);
    }
    expect(check(`${SITE}/`, 'GET', SITE, true)).toBeNull();
    expect(check('http://localhost:4321/', 'GET', SITE, true)).toBeNull();
    // Fora do Cloudflare (proxy pode entregar http mesmo com cadeado): não mexe no protocolo
    expect(check('http://www.mmveiculos.com.br/')).toBeNull();
  });

  it('não redireciona o próprio endereço oficial, localhost, POST ou sem domínio configurado', () => {
    expect(check(`${SITE}/`)).toBeNull();
    expect(check('http://127.0.0.1:4321/veiculos')).toBeNull();
    expect(check('http://localhost:4321/')).toBeNull();
    expect(check('https://mmveiculos.com.br/api/leads', 'POST')).toBeNull();
    expect(check('https://mm-veiculos.lupinho7881.workers.dev/', 'GET', null)).toBeNull();
  });
});
