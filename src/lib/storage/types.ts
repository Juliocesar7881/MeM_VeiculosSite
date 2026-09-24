/**
 * Abstração de armazenamento de objetos (fotos).
 *
 * Implementações:
 *  - local        -> sistema de arquivos (somente desenvolvimento)
 *  - vercel-blob  -> Vercel Blob (store privado; entrega pelo próprio site)
 *  - s3           -> qualquer serviço compatível com S3 (Cloudflare R2, Backblaze B2, AWS S3...)
 *
 * As fotos NUNCA são gravadas no banco nem em Base64. O banco guarda apenas as chaves.
 */
export interface PutOptions {
  contentType: string;
  /** Cache no provedor (segundos). */
  cacheControlMaxAge?: number;
}

export interface StoredObject {
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType: string;
  size: number | null;
  etag: string | null;
}

export interface ObjectStorage {
  readonly driver: string;
  put(key: string, data: Uint8Array, options: PutOptions): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  /** Remove objetos (ignora chaves inexistentes). */
  delete(keys: string[]): Promise<void>;
  copy(fromKey: string, toKey: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}
