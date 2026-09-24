import { createLibsqlDatabase } from '../../src/lib/db/libsql';
import type { Database } from '../../src/lib/db/types';
import { createStorage, type ObjectStorage, type StorageDriver } from '../../src/lib/storage';

/** Conexões (banco + storage) a partir das variáveis de ambiente, para scripts de manutenção. */
export async function connectFromEnv(): Promise<{ db: Database; storage: ObjectStorage; dbUrl: string }> {
  const dbUrl = process.env.DATABASE_URL || 'file:.data/dev.db';
  const db = await createLibsqlDatabase({ url: dbUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
  const storage = await createStorage({
    driver: (process.env.STORAGE_DRIVER as StorageDriver) || 'local',
    localDir: process.env.LOCAL_STORAGE_DIR || '.data/uploads',
    blobToken: process.env.BLOB_READ_WRITE_TOKEN,
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  return { db, storage, dbUrl };
}

/** Tabelas de dados (ordem respeita dependências para restauração). */
export const DATA_TABLES = [
  'site_settings',
  'vehicles',
  'vehicle_features',
  'vehicle_images',
  'vehicle_slug_history',
  'vehicle_leads',
  'vehicle_lead_images',
  'admin_audit_log',
] as const;

export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}
