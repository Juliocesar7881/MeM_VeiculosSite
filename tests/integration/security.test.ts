import type { AstroCookies } from 'astro';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/lib/auth/password';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import type { RateLimitRepository } from '@/repositories/rate-limit-repository';
import { authenticateAdmin } from '@/server/admin-auth';
import type { ServerConfig } from '@/server/config';
import { RateLimiter } from '@/services/rate-limiter';
import { actor, createTestEnv, vehicleInput, type TestEnv } from '../helpers/env';

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.cleanup();
});

const cookieJar = (token: string) =>
  ({ get: (name: string) => (name === SESSION_COOKIE ? { value: token } : undefined) }) as unknown as AstroCookies;
const request = () => new Request('http://localhost/admin');
const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('sessão do painel encerrada no servidor', () => {
  const secret = 's'.repeat(40);

  async function passwordConfig(): Promise<ServerConfig> {
    const passwordHash = await hashPassword('senha-de-teste-bem-forte-123', 20_000);
    return {
      auth: { mode: 'password', passwordHash, sessionSecret: secret, allowedEmails: [] },
    } as unknown as ServerConfig;
  }

  it('"Sair" invalida cookies já emitidos, e um login novo continua valendo', async () => {
    const config = await passwordConfig();
    const binding = config.auth.passwordHash as string;
    const validAfter = () => env.settings.sessionsValidAfter();
    const stolen = cookieJar(await createSessionToken(secret, binding, 'admin', nowSeconds() - 60));

    expect(await authenticateAdmin(request(), stolen, config, validAfter)).not.toBeNull();
    await env.settings.revokeAdminSessions(actor);
    expect(await authenticateAdmin(request(), stolen, config, validAfter)).toBeNull();

    const fresh = cookieJar(await createSessionToken(secret, binding, 'admin', nowSeconds() + 1));
    expect(await authenticateAdmin(request(), fresh, config, validAfter)).not.toBeNull();
  });

  it('"Sair" derruba também a sessão criada no mesmo segundo (precisão de milissegundos)', async () => {
    const config = await passwordConfig();
    const binding = config.auth.passwordHash as string;
    const validAfter = () => env.settings.sessionsValidAfter();
    const justBefore = cookieJar(await createSessionToken(secret, binding, 'admin', Date.now() / 1000 - 0.05));
    await env.settings.revokeAdminSessions(actor);
    expect(await authenticateAdmin(request(), justBefore, config, validAfter)).toBeNull();
    const justAfter = cookieJar(await createSessionToken(secret, binding, 'admin', Date.now() / 1000 + 0.05));
    expect(await authenticateAdmin(request(), justAfter, config, validAfter)).not.toBeNull();
  });

  it('se o corte de sessões não puder ser lido, o acesso é negado', async () => {
    const config = await passwordConfig();
    const token = await createSessionToken(secret, config.auth.passwordHash as string);
    const failing = async (): Promise<number> => {
      throw new Error('banco indisponível');
    };
    expect(await authenticateAdmin(request(), cookieJar(token), config, failing)).toBeNull();
  });

  it('o corte não aparece nas configurações do site', async () => {
    await env.settings.revokeAdminSessions(actor);
    expect(Object.keys(await env.settings.get())).not.toContain('authSessionsValidAfter');
    expect(await env.settings.sessionsValidAfter()).toBeGreaterThan(0);
  });
});

describe('limite de tentativas', () => {
  function fakeRepo(options: { fail?: boolean } = {}) {
    const counts = new Map<string, number>();
    let writes = 0;
    const repo = {
      async hit(key: string) {
        if (options.fail) throw new Error('banco indisponível');
        writes += 1;
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return count;
      },
      async reset(key: string) {
        counts.delete(key);
      },
      async purgeBefore() {},
    } as unknown as RateLimitRepository;
    return { repo, writes: () => writes };
  }

  it('depois do bloqueio, novas tentativas são recusadas sem gravar no banco', async () => {
    const { repo, writes } = fakeRepo();
    const limiter = new RateLimiter(repo, 'salt-bloqueio', () => 1_000_000_000);
    const rule = { bucket: 'teste-bloqueio', limit: 2, windowSeconds: 60 };

    expect((await limiter.check(rule, '9.9.9.9')).allowed).toBe(true);
    expect((await limiter.check(rule, '9.9.9.9')).allowed).toBe(true);
    expect((await limiter.check(rule, '9.9.9.9')).allowed).toBe(false);
    for (let i = 0; i < 20; i += 1) expect((await limiter.check(rule, '9.9.9.9')).allowed).toBe(false);
    expect(writes()).toBe(3);

    await limiter.reset(rule, '9.9.9.9');
    expect((await limiter.check(rule, '9.9.9.9')).allowed).toBe(true);
  });

  it('login bloqueia quando o banco falha (failClosed); formulários públicos seguem liberados', async () => {
    const { repo } = fakeRepo({ fail: true });
    const limiter = new RateLimiter(repo, 'salt-falha');
    const rule = { bucket: 'teste-falha', limit: 5, windowSeconds: 60 };
    expect((await limiter.check(rule, '1.1.1.1', { failClosed: true })).allowed).toBe(false);
    expect((await limiter.check(rule, '1.1.1.1')).allowed).toBe(true);
  });
});

describe('fotos de rascunhos', () => {
  it('só veículos publicados têm fotos públicas', async () => {
    const draft = await env.vehicles.create(vehicleInput({ status: 'draft' }), actor);
    expect(await env.media.isVehiclePublic(draft.id)).toBe(false);

    const published = await env.vehicles.create(vehicleInput({ status: 'available' }), actor);
    expect(await env.media.isVehiclePublic(published.id)).toBe(true);
    expect(await env.media.isVehiclePublic('00000000-0000-4000-8000-000000000000')).toBe(false);
  });

  it('publicar ou tirar do site vale na hora para as fotos (sem esperar o cache)', async () => {
    const draft = await env.vehicles.create(vehicleInput({ status: 'draft' }), actor);
    expect(await env.media.isVehiclePublic(draft.id)).toBe(false); // fica guardado por alguns segundos
    await env.vehicles.quickAction(draft.id, 'publish', actor);
    env.media.forgetPublicStatus(draft.id);
    expect(await env.media.isVehiclePublic(draft.id)).toBe(true);
    await env.vehicles.quickAction(draft.id, 'unpublish', actor);
    env.media.forgetPublicStatus(draft.id);
    expect(await env.media.isVehiclePublic(draft.id)).toBe(false);
  });
});
