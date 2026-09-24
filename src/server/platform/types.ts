import type { Database } from '@/lib/db/types';
import type { ObjectStorage } from '@/lib/storage/types';
import type { ServerConfig } from '../config';
import type { IpSource } from '../http';

/**
 * Dependências que variam conforme onde o site roda.
 *  - node.ts       -> Node/Vercel: libSQL (arquivo local ou Turso), storage local/Blob/S3, sharp
 *  - cloudflare.ts -> Workers: D1, R2 ou KV (bindings)
 * O build escolhe o módulo pelo alias "@/server/platform" (astro.config.mjs).
 */
export interface Platform {
  name: 'node' | 'cloudflare';
  db: Database;
  storage: ObjectStorage;
  /** Header confiável para o IP do cliente (rate limit). */
  ipSource: IpSource;
  /** Gera o JPEG de compartilhamento a partir da foto (somente onde há sharp). */
  renderOgImage?: (body: ReadableStream<Uint8Array> | Uint8Array) => Promise<Uint8Array>;
}

export type CreatePlatform = (config: ServerConfig) => Promise<Platform>;
