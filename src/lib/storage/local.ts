import { mkdir, readFile, rm, stat, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { contentTypeForKey } from './keys';
import { StorageError, type ObjectStorage, type PutOptions, type StoredObject } from './types';

/** Armazenamento em disco — apenas para desenvolvimento local e testes. */
export class LocalStorage implements ObjectStorage {
  readonly driver = 'local';
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  private resolve(key: string): string {
    if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
      throw new StorageError('Chave de armazenamento inválida.');
    }
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new StorageError('Chave fora do diretório.');
    return full;
  }

  async put(key: string, data: Uint8Array, _options: PutOptions): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async get(key: string): Promise<StoredObject | null> {
    const file = this.resolve(key);
    try {
      const [data, info] = await Promise.all([readFile(file), stat(file)]);
      return {
        body: new Uint8Array(data),
        contentType: contentTypeForKey(key),
        size: info.size,
        etag: `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new StorageError('Falha ao ler arquivo local.', { cause: error });
    }
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.resolve(key), { force: true })));
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    const target = this.resolve(toKey);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(this.resolve(fromKey), target);
  }
}
