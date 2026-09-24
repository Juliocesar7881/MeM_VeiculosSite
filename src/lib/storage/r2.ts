import { contentTypeForKey } from './keys';
import type { ObjectStorage, PutOptions, StoredObject } from './types';

/** Cloudflare R2 via binding nativo do Workers (bucket privado; entrega pelo próprio site). */
export class R2Storage implements ObjectStorage {
  readonly driver = 'r2';

  constructor(private readonly bucket: CfR2Bucket) {}

  async put(key: string, data: Uint8Array, options: PutOptions): Promise<void> {
    await this.bucket.put(key, data, {
      httpMetadata: {
        contentType: options.contentType,
        cacheControl: `public, max-age=${options.cacheControlMaxAge ?? 31_536_000}, immutable`,
      },
    });
  }

  async get(key: string): Promise<StoredObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType ?? contentTypeForKey(key),
      size: object.size,
      etag: object.httpEtag,
    };
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length) await this.bucket.delete(keys);
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const source = await this.bucket.get(fromKey);
    if (!source) throw new Error(`Objeto não encontrado: ${fromKey}`);
    await this.bucket.put(toKey, await source.arrayBuffer(), {
      httpMetadata: { contentType: source.httpMetadata?.contentType ?? contentTypeForKey(toKey) },
    });
  }
}
