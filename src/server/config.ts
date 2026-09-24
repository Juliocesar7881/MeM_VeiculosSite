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
    driver: StorageDriver;
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
      passwordHash: ADMIN_PASSWORD_HASH,
      sessionSecret: SESSION_SECRET,
      accessTeamDomain: CF_ACCESS_TEAM_DOMAIN,
      accessAudience: CF_ACCESS_AUD,
      allowedEmails: (ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
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

  if (isProduction && cached.database.url.startsWith('file:') && process.env.VERCEL) {
    console.error('[config] DATABASE_URL aponta para arquivo local em ambiente Vercel. Configure o Turso (libsql://).');
  }
  return cached;
}
