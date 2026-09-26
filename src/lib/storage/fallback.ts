import type { ObjectStorage, PutOptions, StoredObject } from './types';

/**
 * Troca de armazenamento sem perder fotos (ex.: KV -> R2): grava e lê no novo; o que ainda não foi
 * copiado é lido do antigo. Terminada a cópia (scripts/cf-migrate-media.ts), basta remover o binding
 * antigo do wrangler.jsonc.
 */
export class FallbackStorage implements ObjectStorage {
  readonly driver: string;

  constructor(
    private readonly primary: ObjectStorage,
    private readonly previous: ObjectStorage,
  ) {
    this.driver = primary.driver;
  }

  put(key: string, data: Uint8Array, options: PutOptions): Promise<void> {
    return this.primary.put(key, data, options);
  }

  async get(key: string): Promise<StoredObject | null> {
    return (await this.primary.get(key)) ?? this.previous.get(key);
  }

  async delete(keys: string[]): Promise<void> {
    await this.primary.delete(keys);
    // No antigo é só limpeza (e no KV grátis apagar conta na cota diária): falha não impede nada.
    await this.previous
      .delete(keys)
      .catch((error: unknown) => console.warn('[storage] não foi possível apagar a cópia antiga', error));
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const source = await this.get(fromKey);
    if (!source) throw new Error(`Objeto não encontrado: ${fromKey}`);
    const bytes =
      source.body instanceof Uint8Array ? source.body : new Uint8Array(await new Response(source.body).arrayBuffer());
    await this.primary.put(toKey, bytes, { contentType: source.contentType });
  }
}
