import { AwsClient } from 'aws4fetch';
import { StorageError, type ObjectStorage, type PutOptions, type StoredObject } from './types';

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Driver compatível com S3 (Cloudflare R2, Backblaze B2, AWS S3, MinIO...).
 * Usa apenas fetch + assinatura SigV4 (aws4fetch), sem SDK pesado.
 * O bucket deve ser PRIVADO — a entrega é feita pelo próprio site.
 */
export class S3Storage implements ObjectStorage {
  readonly driver = 's3';
  private readonly client: AwsClient;
  private readonly baseUrl: string;

  constructor(private readonly config: S3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      service: 's3',
    });
    this.baseUrl = `${config.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(config.bucket)}`;
  }

  private url(key: string): string {
    return `${this.baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async put(key: string, data: Uint8Array, options: PutOptions): Promise<void> {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: {
        'Content-Type': options.contentType,
        'Cache-Control': `public, max-age=${options.cacheControlMaxAge ?? 31_536_000}, immutable`,
      },
    });
    if (!res.ok) throw new StorageError(`Falha no upload S3 (${res.status}).`);
  }

  async get(key: string): Promise<StoredObject | null> {
    const res = await this.client.fetch(this.url(key), { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok || !res.body) throw new StorageError(`Falha ao ler objeto S3 (${res.status}).`);
    const length = res.headers.get('content-length');
    return {
      body: res.body,
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      size: length ? Number(length) : null,
      etag: res.headers.get('etag'),
    };
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        const res = await this.client.fetch(this.url(key), { method: 'DELETE' });
        if (!res.ok && res.status !== 404) {
          throw new StorageError(`Falha ao remover objeto S3 (${res.status}).`);
        }
      }),
    );
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const source = `/${this.config.bucket}/${fromKey.split('/').map(encodeURIComponent).join('/')}`;
    const res = await this.client.fetch(this.url(toKey), {
      method: 'PUT',
      headers: { 'x-amz-copy-source': source },
    });
    if (!res.ok) throw new StorageError(`Falha ao copiar objeto S3 (${res.status}).`);
  }
}
