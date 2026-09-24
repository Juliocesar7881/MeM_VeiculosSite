import type { ObjectStorage } from './types';

export type StorageDriver = 'local' | 'vercel-blob' | 's3';

export interface StorageConfig {
  driver: StorageDriver;
  localDir?: string | undefined;
  blobToken?: string | undefined;
  s3?: {
    endpoint?: string | undefined;
    bucket?: string | undefined;
    region?: string | undefined;
    accessKeyId?: string | undefined;
    secretAccessKey?: string | undefined;
  };
}

export async function createStorage(config: StorageConfig): Promise<ObjectStorage> {
  switch (config.driver) {
    case 'local': {
      const { LocalStorage } = await import('./local');
      return new LocalStorage(config.localDir ?? '.data/uploads');
    }
    case 'vercel-blob': {
      const { VercelBlobStorage } = await import('./vercel-blob');
      return new VercelBlobStorage(config.blobToken || undefined);
    }
    case 's3': {
      const s3 = config.s3 ?? {};
      if (!s3.endpoint || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
        throw new Error('STORAGE_DRIVER=s3 requer S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.');
      }
      const { S3Storage } = await import('./s3');
      return new S3Storage({
        endpoint: s3.endpoint,
        bucket: s3.bucket,
        region: s3.region || 'auto',
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      });
    }
    default: {
      const exhaustive: never = config.driver;
      throw new Error(`Driver de armazenamento desconhecido: ${String(exhaustive)}`);
    }
  }
}

export * from './types';
export * from './keys';
