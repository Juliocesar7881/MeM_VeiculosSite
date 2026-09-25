import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/lib/auth/password';
import { createLibsqlDatabase } from '@/lib/db/libsql';
import { applyMigrations } from '@/lib/db/migrator';
import type { Database } from '@/lib/db/types';
import { RateLimitRepository } from '@/repositories/rate-limit-repository';
import { attemptAdminLogin } from '@/server/admin-login';
import { RateLimiter } from '@/services/rate-limiter';
import { loadMigrationFiles } from '../../scripts/lib/migrations';

const PASSWORD = 'senha-certa-do-painel-123';
let passwordHash: string;
let db: Database & { close: () => Promise<void> };
let clock: number;
let limiter: RateLimiter;
let run = 0;

beforeEach(async () => {
  passwordHash ??= await hashPassword(PASSWORD, 20_000);
  db = await createLibsqlDatabase({ url: ':memory:' });
  await applyMigrations(db, await loadMigrationFiles(path.resolve(process.cwd(), 'migrations')));
  clock = 1_800_000_000_000 + run * 10_000_000_000;
  // Sal diferente a cada teste: o bloqueio em memória do módulo não vaza entre testes.
  limiter = new RateLimiter(new RateLimitRepository(db), `salt-${(run += 1)}`, () => clock);
});
afterEach(async () => {
  await db.close();
});

const login = (password: string, ip = '203.0.113.7') =>
  attemptAdminLogin(limiter, ip, async () => password, passwordHash);
const minutes = (n: number) => (clock += n * 60_000);

describe('login do painel: bloqueio por tentativas', () => {
  it('avisa quantas tentativas restam e bloqueia 30 minutos após 5 erros', async () => {
    const messages: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await login('senha-errada');
      expect(r.ok).toBe(false);
      if (!r.ok) messages.push(r.error);
    }
    expect(messages[0]).toContain('Restam 4 tentativas');
    expect(messages[3]).toContain('Resta 1 tentativa');
    expect(messages[4]).toContain('bloqueado por 30 minutos');

    // Bloqueado: nem a senha certa entra, e a senha nem é lida.
    let read = false;
    const blocked = await attemptAdminLogin(
      limiter,
      '203.0.113.7',
      async () => ((read = true), PASSWORD),
      passwordHash,
    );
    expect(blocked).toEqual({ ok: false, error: expect.stringContaining('Tente de novo em 30 minutos') });
    expect(read).toBe(false);

    minutes(29);
    expect((await login(PASSWORD)).ok).toBe(false);
    minutes(1);
    expect((await login(PASSWORD)).ok).toBe(true);
  });

  it('o bloqueio vale só para o IP que errou', async () => {
    for (let i = 0; i < 5; i += 1) await login('senha-errada', '198.51.100.1');
    expect((await login(PASSWORD, '198.51.100.1')).ok).toBe(false);
    expect((await login(PASSWORD, '198.51.100.2')).ok).toBe(true);
  });

  it('acertar a senha zera a contagem de erros', async () => {
    for (let i = 0; i < 4; i += 1) await login('senha-errada');
    expect((await login(PASSWORD)).ok).toBe(true);
    const r = await login('senha-errada');
    expect(!r.ok && r.error).toContain('Restam 4 tentativas');
  });

  it('erros espaçados (mais de 30 minutos) recomeçam a contagem', async () => {
    for (let i = 0; i < 4; i += 1) await login('senha-errada');
    minutes(31);
    const r = await login('senha-errada');
    expect(!r.ok && r.error).toContain('Restam 4 tentativas');
  });

  it('requisições simultâneas não passam do limite de 5 conferências de senha', async () => {
    let checked = 0;
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        attemptAdminLogin(limiter, '192.0.2.50', async () => ((checked += 1), 'senha-errada'), passwordHash),
      ),
    );
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(checked).toBeLessThanOrEqual(5);
    expect((await login(PASSWORD, '192.0.2.50')).ok).toBe(false);
  });

  it('ataque distribuído (muitos IPs) pausa o login de todos', async () => {
    for (let i = 0; i < 100; i += 1) await login('senha-errada', `10.0.${Math.floor(i / 4)}.${i % 4}`);
    const r = await login(PASSWORD, '198.51.100.99');
    expect(!r.ok && r.error).toContain('Login pausado por segurança');
    minutes(30);
    expect((await login(PASSWORD, '198.51.100.99')).ok).toBe(true);
  });

  it('banco fora do ar: login bloqueado (não aceita tentativas sem contar)', async () => {
    await db.close();
    const r = await attemptAdminLogin(
      new RateLimiter(new RateLimitRepository(db), 'salt-sem-banco', () => clock),
      '203.0.113.200',
      async () => PASSWORD,
      passwordHash,
    );
    expect(r.ok).toBe(false);
    db = await createLibsqlDatabase({ url: ':memory:' });
  });
});
