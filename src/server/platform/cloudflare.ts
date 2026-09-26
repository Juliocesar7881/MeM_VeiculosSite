import { env } from 'cloudflare:workers';
import { createD1Database } from '@/lib/db/d1';
import { FallbackStorage } from '@/lib/storage/fallback';
import { KvStorage } from '@/lib/storage/kv';
import { R2Storage } from '@/lib/storage/r2';
import { S3Storage } from '@/lib/storage/s3';
import type { ObjectStorage } from '@/lib/storage/types';
import type { CreatePlatform } from './types';

/** Cloudflare Workers: D1 (binding DB) + R2 (binding MEDIA) ou KV (binding MEDIA_KV). */
export const createPlatform: CreatePlatform = async (config) => {
  if (!env.DB) throw new Error('Binding D1 "DB" não configurado no wrangler.jsonc.');

  let storage: ObjectStorage;
  // Em `npm run cf:dev` o .env local (STORAGE_DRIVER=local) sobrepõe o wrangler.jsonc:
  // no Workers não há disco, então usamos o KV (simulado localmente pelo Wrangler).
  const driver = config.storage.driver === 'local' ? 'kv' : config.storage.driver;
  switch (driver) {
    case 'r2':
      if (!env.MEDIA) throw new Error('Binding R2 "MEDIA" não configurado no wrangler.jsonc.');
      // Migração KV -> R2: enquanto o KV continuar configurado, o que não estiver no R2 é lido de lá.
      storage = env.MEDIA_KV
        ? new FallbackStorage(new R2Storage(env.MEDIA), new KvStorage(env.MEDIA_KV))
        : new R2Storage(env.MEDIA);
      break;
    case 'kv':
      if (!env.MEDIA_KV) throw new Error('Binding KV "MEDIA_KV" não configurado no wrangler.jsonc.');
      storage = new KvStorage(env.MEDIA_KV);
      break;
    case 's3': {
      const s3 = config.storage.s3;
      if (!s3.endpoint || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
        throw new Error('STORAGE_DRIVER=s3 requer S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.');
      }
      storage = new S3Storage({
        endpoint: s3.endpoint,
        bucket: s3.bucket,
        region: s3.region || 'auto',
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      });
      break;
    }
    default:
      throw new Error(`STORAGE_DRIVER=${driver} não é suportado no Cloudflare. Use r2 ou kv.`);
  }

  // Sem sharp no Workers: a imagem de compartilhamento é gerada no navegador durante o upload.
  return { name: 'cloudflare', db: createD1Database(env.DB), storage };
};
