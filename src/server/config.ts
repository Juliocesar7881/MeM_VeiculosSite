import {
  ADMIN_EMAILS,
  ADMIN_PASSWORD_HASH,
  ALLOW_INDEXING,
  AUTH_MODE,
  BLOB_READ_WRITE_TOKEN,
  CF_ACCESS_AUD,
  CF_ACCESS_TEAM_DOMAIN,
  DATABASE_AUTH_TOKEN,
  DATABASE_URL,
  IP_HASH_SALT,
  LEAD_NOTIFICATION_EMAIL,
  LEAD_NOTIFICATION_FROM,
  LOCAL_STORAGE_DIR,
  PUBLIC_SITE_URL,
  RESEND_API_KEY,
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  SESSION_SECRET,
  STORAGE_DRIVER,
  TURNSTILE_SECRET_KEY,
  TURNSTILE_SITE_KEY,
} from 'astro:env/server';
import { DEV_ADMIN_PASSWORD_HASH } from '@/config/dev-auth';
import { toBase64Url } from '@/lib/auth/password';
import { TURNSTILE_TEST_KEYS } from '@/lib/turnstile';
import type { StorageDriver } from '@/lib/storage';

/**
 * Configuração do servidor lida em tempo de execução (astro:env).
 * Segredos nunca são enviados ao navegador.
 */
export interface ServerConfig {
  isProduction: boolean;
  siteUrl: string | null;
  allowIndexing: boolean;
  database: { url: string; authToken?: string | undefined };
  storage: {
    /** local | vercel-blob | s3 (Node/Vercel) · r2 | kv | s3 (Cloudflare Workers) */
    driver: StorageDriver | 'kv' | 'r2';
    localDir: string;
    blobToken?: string | undefined;
    s3: {
      endpoint?: string | undefined;
      bucket?: string | undefined;
      region?: string | undefined;
      accessKeyId?: string | undefined;
      secretAccessKey?: string | undefined;
    };
  };
  auth: {
    mode: 'password' | 'cloudflare-access';
    passwordHash?: string | undefined;
    sessionSecret?: string | undefined;
    accessTeamDomain?: string | undefined;
    accessAudience?: string | undefined;
    allowedEmails: string[];
    /** Desenvolvimento local sem ADMIN_PASSWORD_HASH: senha padrão de dev (src/config/dev-auth.ts). */
    usingDevPassword: boolean;
  };
  turnstile: { siteKey: string; secretKey: string; usingTestKeys: boolean; configured: boolean };
  ipHashSalt: string;
  notifications: { resendApiKey?: string | undefined; to?: string | undefined; from: string };
}

let cached: ServerConfig | null = null;

export function getServerConfig(): ServerConfig {
  if (cached) return cached;
  const isProduction = import.meta.env.PROD;
  const hasTurnstile = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY);
  const useTestKeys = !hasTurnstile && !isProduction;
  const usingDevPassword = !isProduction && !ADMIN_PASSWORD_HASH;

  cached = {
    isProduction,
    siteUrl: PUBLIC_SITE_URL ? PUBLIC_SITE_URL.replace(/\/+$/, '') : null,
    allowIndexing: ALLOW_INDEXING,
    database: { url: DATABASE_URL ?? 'file:.data/dev.db', authToken: DATABASE_AUTH_TOKEN },
    storage: {
      driver: STORAGE_DRIVER,
      localDir: LOCAL_STORAGE_DIR ?? '.data/uploads',
      blobToken: BLOB_READ_WRITE_TOKEN,
      s3: {
        endpoint: S3_ENDPOINT,
        bucket: S3_BUCKET,
        region: S3_REGION,
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    },
    auth: {
      mode: AUTH_MODE,
      passwordHash: usingDevPassword ? DEV_ADMIN_PASSWORD_HASH : ADMIN_PASSWORD_HASH,
      // Em dev sem segredo configurado, as sessões valem só até reiniciar o servidor.
      sessionSecret:
        SESSION_SECRET ?? (usingDevPassword ? toBase64Url(crypto.getRandomValues(new Uint8Array(32))) : undefined),
      accessTeamDomain: CF_ACCESS_TEAM_DOMAIN,
      accessAudience: CF_ACCESS_AUD,
      allowedEmails: (ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
      usingDevPassword,
    },
    turnstile: {
      siteKey: hasTurnstile ? (TURNSTILE_SITE_KEY as string) : useTestKeys ? TURNSTILE_TEST_KEYS.siteKey : '',
      secretKey: hasTurnstile ? (TURNSTILE_SECRET_KEY as string) : useTestKeys ? TURNSTILE_TEST_KEYS.secretKey : '',
      usingTestKeys: useTestKeys,
      configured: hasTurnstile || useTestKeys,
    },
    ipHashSalt: IP_HASH_SALT ?? SESSION_SECRET ?? 'mm-veiculos-dev-salt',
    notifications: {
      resendApiKey: RESEND_API_KEY,
      to: LEAD_NOTIFICATION_EMAIL,
      from: LEAD_NOTIFICATION_FROM ?? 'M&M Veículos <onboarding@resend.dev>',
    },
  };

  const onVercel = Boolean(globalThis.process?.env?.VERCEL);
  if (isProduction && cached.database.url.startsWith('file:') && onVercel) {
    console.error('[config] DATABASE_URL aponta para arquivo local em ambiente Vercel. Configure o Turso (libsql://).');
  }
  return cached;
}
