import { StorageQuotaError } from '@/lib/errors';
import { contentTypeForKey } from './keys';
import type { ObjectStorage, PutOptions, StoredObject } from './types';

interface KvMeta {
  contentType?: string;
  size?: number;
}

/** Converte o erro de cota diária do KV (plano gratuito) numa mensagem clara para o painel. */
async function withQuota<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof Error && /limit exceeded|quota/i.test(error.message)) throw new StorageQuotaError();
    throw error;
  }
}

/**
 * Fotos no Cloudflare Workers KV — alternativa GRATUITA e sem cartão enquanto o R2 não é
 * ativado na conta. Limites do plano gratuito: 1 GB, 100 mil leituras e 1 mil gravações por dia.
 * Para trocar para o R2 basta mudar STORAGE_DRIVER=r2 e copiar os arquivos (docs/DEPLOY.md).
 */
export class KvStorage implements ObjectStorage {
  readonly driver = 'kv';

  constructor(private readonly kv: CfKVNamespace) {}

  async put(key: string, data: Uint8Array, options: PutOptions): Promise<void> {
    const meta: KvMeta = { contentType: options.contentType, size: data.byteLength };
    await withQuota(this.kv.put(key, data, { metadata: meta }));
  }

  async get(key: string): Promise<StoredObject | null> {
    // cacheTtl: a borda da Cloudflare guarda a leitura (arquivos nunca mudam de conteúdo).
    const { value, metadata } = await this.kv.getWithMetadata<KvMeta>(key, { type: 'stream', cacheTtl: 86_400 });
    if (!value) return null;
    return {
      body: value,
      contentType: metadata?.contentType ?? contentTypeForKey(key),
      size: metadata?.size ?? null,
      etag: null,
    };
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.kv.delete(key)));
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const { value, metadata } = await this.kv.getWithMetadata<KvMeta>(fromKey, { type: 'arrayBuffer' });
    if (!value) throw new Error(`Objeto não encontrado: ${fromKey}`);
    await withQuota(this.kv.put(toKey, value, { metadata: metadata ?? { contentType: contentTypeForKey(toKey) } }));
  }
}
