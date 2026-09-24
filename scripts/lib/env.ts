import { existsSync } from 'node:fs';
import path from 'node:path';

/** Carrega o .env local (se existir) para scripts executados fora do Astro. */
export function loadEnv(): void {
  const file = path.resolve(process.cwd(), '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    console.error(`Variável de ambiente ${name} não definida.`);
    process.exit(1);
  }
  return value;
}

export function isLocalDatabase(url: string): boolean {
  return url.startsWith('file:') || url === ':memory:';
}
