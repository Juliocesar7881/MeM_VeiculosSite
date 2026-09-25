import { describe, expect, it, vi } from 'vitest';
import { hashPassword, isValidPasswordHash, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, SESSION_TTL_SECONDS, verifySessionToken } from '@/lib/auth/session';
import { splitSqlStatements } from '@/lib/db/migrator';
import { buildCsp } from '@/server/security-headers';
import { safeAdminRedirect } from '@/server/admin-auth';
import { flashUrl, readFlash } from '@/server/flash';
import { clientIp } from '@/server/http';

describe('senha (PBKDF2)', () => {
  it('gera hash verificável e rejeita senha errada', async () => {
    const hash = await hashPassword('senha-muito-segura-123', 100_000);
    expect(hash.startsWith('pbkdf2-sha256$100000$')).toBe(true);
    expect(isValidPasswordHash(hash)).toBe(true);
    expect(await verifyPassword('senha-muito-segura-123', hash)).toBe(true);
    expect(await verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('hashes diferentes para a mesma senha (salt)', async () => {
    expect(await hashPassword('abc-abc-abc-abc', 100_000)).not.toBe(await hashPassword('abc-abc-abc-abc', 100_000));
  });

  it('rejeita formatos inválidos', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2-sha256$10$aaa$bbb')).toBe(false);
    expect(isValidPasswordHash('')).toBe(false);
  });
});

describe('sessão assinada', () => {
  const secret = 'x'.repeat(40);
  const binding = 'pbkdf2-sha256$600000$salt$hash';

  it('token válido é aceito', async () => {
    const token = await createSessionToken(secret, binding, 'admin', 1_000);
    const payload = await verifySessionToken(token, secret, binding, 1_010);
    expect(payload?.sub).toBe('admin');
  });

  it('expira após o TTL', async () => {
    const token = await createSessionToken(secret, binding, 'admin', 1_000);
    expect(await verifySessionToken(token, secret, binding, 1_000 + SESSION_TTL_SECONDS + 1)).toBeNull();
  });

  it('adulteração, outro segredo ou troca de senha invalidam', async () => {
    const token = await createSessionToken(secret, binding, 'admin', 1_000);
    const [payload, sig] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ sub: 'admin', iat: 1, exp: 9e9 })).toString('base64url')}.${sig}`;
    expect(await verifySessionToken(forged, secret, binding, 1_010)).toBeNull();
    expect(await verifySessionToken(`${payload}.AAAA`, secret, binding, 1_010)).toBeNull();
    expect(await verifySessionToken(token, 'y'.repeat(40), binding, 1_010)).toBeNull();
    expect(await verifySessionToken(token, secret, 'outra-senha', 1_010)).toBeNull();
    expect(await verifySessionToken(undefined, secret, binding)).toBeNull();
  });
});

describe('redirecionamento seguro pós-login', () => {
  it.each([
    ['/admin/veiculos', '/admin/veiculos'],
    ['https://evil.com', '/admin'],
    ['//evil.com/admin', '/admin'],
    ['/admin/login', '/admin'],
    [null, '/admin'],
  ])('%s -> %s', (input, expected) => {
    expect(safeAdminRedirect(input)).toBe(expected);
  });
});

describe('CSP', () => {
  it('produção bloqueia inline scripts e permite apenas Turnstile externo', () => {
    const csp = buildCsp({ isProduction: true, isHttps: true });
    expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain('ws:');
  });

  it('sem HTTPS (preview local) não força upgrade de requisições', () => {
    expect(buildCsp({ isProduction: true, isHttps: false })).not.toContain('upgrade-insecure-requests');
  });
});

describe('splitSqlStatements', () => {
  it('divide instruções respeitando strings e comentários', () => {
    const sql = `-- comentário; com ponto e vírgula\nCREATE TABLE a (x TEXT);\nINSERT INTO a VALUES ('um;dois');\nINSERT INTO a VALUES ('it''s');`;
    expect(splitSqlStatements(sql)).toEqual([
      'CREATE TABLE a (x TEXT)',
      "INSERT INTO a VALUES ('um;dois')",
      "INSERT INTO a VALUES ('it''s')",
    ]);
  });
});

describe('IP do cliente (limite de tentativas)', () => {
  const forged = () =>
    new Request('http://localhost/', {
      headers: { 'cf-connecting-ip': '6.6.6.6', 'x-real-ip': '7.7.7.7', 'x-forwarded-for': '8.8.8.8, 10.0.0.2' },
    });

  it('Cloudflare: usa o CF-Connecting-IP escrito pela borda', () => {
    expect(clientIp(forged(), '10.0.0.1', 'cloudflare')).toBe('6.6.6.6');
  });

  it('Node direto: ignora cabeçalhos que o visitante pode forjar e usa o endereço da conexão', () => {
    expect(clientIp(forged(), '10.0.0.1', 'node')).toBe('10.0.0.1');
    expect(clientIp(forged(), undefined, 'node')).toBe('unknown');
  });

  it('Vercel: usa o X-Real-IP reescrito pela plataforma', () => {
    vi.stubEnv('VERCEL', '1');
    try {
      expect(clientIp(forged(), '10.0.0.1', 'node')).toBe('7.7.7.7');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('avisos do painel assinados', () => {
  const secret = 'segredo-de-teste-com-mais-de-32-caracteres';

  it('aviso gerado pelo servidor é exibido (mantendo a âncora)', async () => {
    const location = await flashUrl('/admin/veiculos/abc#fotos', 'Alterações salvas.', 'ok', secret);
    expect(location.endsWith('#fotos')).toBe(true);
    expect(await readFlash(new URL(location, 'http://x'), secret)).toEqual({
      kind: 'ok',
      message: 'Alterações salvas.',
    });
  });

  it('texto falso vindo de um link de terceiros é ignorado', async () => {
    expect(await readFlash(new URL('http://x/admin?ok=Veículo%20excluído'), secret)).toBeNull();
    const signed = new URL(await flashUrl('/admin', 'Anotações salvas.', 'ok', secret), 'http://x');
    signed.searchParams.set('ok', 'Ligue para 0800 000 0000');
    expect(await readFlash(signed, secret)).toBeNull();
  });

  it('assinatura de um aviso não vale para o outro tipo nem com outra chave', async () => {
    const signed = new URL(await flashUrl('/admin', 'Ação inválida.', 'erro', secret), 'http://x');
    const swapped = new URL(signed);
    swapped.searchParams.set('ok', 'Ação inválida.');
    swapped.searchParams.delete('erro');
    expect(await readFlash(swapped, secret)).toBeNull();
    expect(await readFlash(signed, 'outra-chave-com-mais-de-32-caracteres!!')).toBeNull();
  });
});
