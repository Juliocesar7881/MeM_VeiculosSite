/**
 * Tipos mínimos dos bindings do Cloudflare Workers usados pelo projeto.
 * (Evita incluir @cloudflare/workers-types globalmente, que conflita com os tipos do DOM.)
 */
interface CfD1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number; duration: number };
}

interface CfD1PreparedStatement {
  bind(...values: unknown[]): CfD1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<CfD1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<CfD1Result>;
}

interface CfD1Database {
  prepare(query: string): CfD1PreparedStatement;
  batch(statements: CfD1PreparedStatement[]): Promise<CfD1Result[]>;
  exec(query: string): Promise<unknown>;
}

interface CfKVNamespace {
  get(key: string, options: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
  getWithMetadata<M>(
    key: string,
    options: { type: 'stream'; cacheTtl?: number },
  ): Promise<{ value: ReadableStream<Uint8Array> | null; metadata: M | null }>;
  getWithMetadata<M>(
    key: string,
    options: { type: 'arrayBuffer'; cacheTtl?: number },
  ): Promise<{ value: ArrayBuffer | null; metadata: M | null }>;
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface CfR2Object {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag: string;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface CfR2Bucket {
  get(key: string): Promise<CfR2Object | null>;
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

interface CloudflareEnv {
  DB?: CfD1Database;
  MEDIA?: CfR2Bucket;
  MEDIA_KV?: CfKVNamespace;
}

declare module 'cloudflare:workers' {
  export const env: CloudflareEnv;
}
