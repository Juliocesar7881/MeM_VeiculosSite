import { contentTypeForKey } from './keys';
import type { ObjectStorage, PutOptions, StoredObject } from './types';

interface KvMeta {
  contentType?: string;
  size?: number;
}

/**
 * Fotos no Cloudflare Workers KV — alternativa GRATUITA e sem cartão enquanto o R2 não é
 * ativado na conta. Limites do plano gratuito: 1 GB, 100 mil leituras e 1 mil gravações por dia.
 * Para trocar para o R2 basta mudar STORAGE_DRIVER=r2 e copiar os arquivos (docs/DEPLOY-CLOUDFLARE.md).
 */
export class KvStorage implements ObjectStorage {
  readonly driver = 'kv';

  constructor(private readonly kv: CfKVNamespace) {}

  async put(key: string, data: Uint8Array, options: PutOptions): Promise<void> {
    const meta: KvMeta = { contentType: options.contentType, size: data.byteLength };
    await this.kv.put(key, data, { metadata: meta });
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
    await this.kv.put(toKey, value, { metadata: metadata ?? { contentType: contentTypeForKey(toKey) } });
  }
}
