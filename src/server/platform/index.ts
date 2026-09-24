/**
 * Ponto de entrada da plataforma. Em builds para o Cloudflare, o astro.config.mjs substitui
 * este módulo por "./cloudflare.ts" (alias), mantendo libSQL/sharp/fs fora do Worker.
 */
export { createPlatform } from './node';
export type { Platform } from './types';
