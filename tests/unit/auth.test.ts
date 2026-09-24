import { describe, expect, it } from 'vitest';
import { hashPassword, isValidPasswordHash, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, SESSION_TTL_SECONDS, verifySessionToken } from '@/lib/auth/session';
import { splitSqlStatements } from '@/lib/db/migrator';
import { buildCsp } from '@/server/security-headers';
import { safeAdminRedirect } from '@/server/admin-auth';
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

describe('IP do cliente (rate limit)', () => {
  const req = (headers: Record<string, string>) => new Request('https://example.com/', { headers });
  const socket = () => '10.0.0.9';

  it('Cloudflare: usa CF-Connecting-IP', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '2.2.2.2' }), 'cloudflare', socket)).toBe(
      '1.1.1.1',
    );
  });

  it('Vercel: ignora CF-Connecting-IP forjado pelo cliente', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '6.6.6.6', 'x-real-ip': '2.2.2.2' }), 'vercel', socket)).toBe('2.2.2.2');
    expect(clientIp(req({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }), 'vercel', socket)).toBe('3.3.3.3');
  });

  it('Servidor direto: usa só o endereço do socket', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '6.6.6.6', 'x-forwarded-for': '7.7.7.7' }), 'direct', socket)).toBe(
      '10.0.0.9',
    );
    const throwing = () => {
      throw new Error('indisponível');
    };
    expect(clientIp(req({}), 'direct', throwing)).toBe('unknown');
  });
});
