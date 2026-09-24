import { createLibsqlDatabase } from '@/lib/db/libsql';
import { createStorage } from '@/lib/storage';
import type { CreatePlatform } from './types';

/** Node.js / Vercel: libSQL (arquivo local ou Turso) + storage local, Vercel Blob ou S3/R2. */
export const createPlatform: CreatePlatform = async (config) => {
  const driver = config.storage.driver;
  if (driver === 'kv' || driver === 'r2') {
    throw new Error(`STORAGE_DRIVER=${driver} só funciona no Cloudflare Workers. Use local, vercel-blob ou s3.`);
  }
  const [db, storage] = await Promise.all([
    createLibsqlDatabase(config.database),
    createStorage({ ...config.storage, driver }),
  ]);
  return {
    name: 'node',
    db,
    storage,
    renderOgImage: async (body) => {
      const { renderOgImage } = await import('@/server/og-image');
      return new Uint8Array(await renderOgImage(body));
    },
  };
};
