import { copy, del, get, put } from '@vercel/blob';
import { StorageError, type ObjectStorage, type PutOptions, type StoredObject } from './types';

/**
 * Vercel Blob em modo PRIVADO. Nada é acessível publicamente pela URL do Blob;
 * as fotos de veículos são entregues por /media/* (com cache de CDN) e as fotos de
 * propostas por /api/admin/lead-media/* (somente administradores).
 *
 * Autenticação: na Vercel, OIDC automático ao conectar o store ao projeto
 * (BLOB_STORE_ID). Fora da Vercel, BLOB_READ_WRITE_TOKEN.
 */
export class VercelBlobStorage implements ObjectStorage {
  readonly driver = 'vercel-blob';

  constructor(private readonly token?: string) {}

  private auth() {
    return this.token ? { token: this.token } : {};
  }

  async put(key: string, data: Uint8Array, options: PutOptions): Promise<void> {
    try {
      await put(key, Buffer.from(data), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: options.contentType,
        cacheControlMaxAge: options.cacheControlMaxAge ?? 60 * 60 * 24 * 30,
        ...this.auth(),
      });
    } catch (error) {
      throw new StorageError('Falha ao enviar arquivo ao Vercel Blob.', { cause: error });
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const result = await get(key, { access: 'private', ...this.auth() });
      if (!result || result.statusCode !== 200) return null;
      return {
        body: result.stream,
        contentType: result.blob.contentType,
        size: result.blob.size,
        etag: result.blob.etag,
      };
    } catch (error) {
      if (error instanceof Error && /not.?found/i.test(error.message)) return null;
      throw new StorageError('Falha ao ler arquivo do Vercel Blob.', { cause: error });
    }
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await del(keys, this.auth());
    } catch (error) {
      throw new StorageError('Falha ao remover arquivo do Vercel Blob.', { cause: error });
    }
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    try {
      await copy(fromKey, toKey, { access: 'private', addRandomSuffix: false, ...this.auth() });
    } catch (error) {
      throw new StorageError('Falha ao copiar arquivo no Vercel Blob.', { cause: error });
    }
  }
}
