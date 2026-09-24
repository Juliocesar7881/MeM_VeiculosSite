/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    container: import('./server/container').Container;
    /** URL base usada em links absolutos (canonical, Open Graph, WhatsApp). */
    siteUrl: string;
    admin?: import('./types/domain').AdminActor;
    /** Contexto de execução do Cloudflare Workers (definido pelo adapter; ausente em Node/Vercel). */
    cfContext?: { waitUntil(promise: Promise<unknown>): void };
  }
}
