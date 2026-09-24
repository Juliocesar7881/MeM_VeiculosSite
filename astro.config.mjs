// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// A URL definitiva só é necessária em produção. Em desenvolvimento/preview o site
// funciona com a URL local ou com a URL da própria requisição.
const site = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';

const secret = (/** @type {{ optional?: boolean; default?: string }} */ opts = {}) =>
  envField.string({ context: 'server', access: 'secret', optional: true, ...opts });

/**
 * Destino do build (DEPLOY_TARGET):
 *  - cloudflare -> Workers + D1 + R2/KV (produção recomendada, plano gratuito)
 *  - vercel     -> Vercel Functions + Turso + Blob
 *  - node       -> servidor Node (desenvolvimento local e `npm run preview:local`)
 */
const target = process.env.DEPLOY_TARGET ?? 'node';

const adapters = {
  cloudflare: () =>
    cloudflare({
      // Fotos já chegam otimizadas (WebP) — sem serviço de imagens nem binding IMAGES.
      imageService: 'passthrough',
      imagesBindingName: false,
    }),
  vercel: () =>
    vercel({
      maxDuration: 30,
      imageService: false,
    }),
  node: () => node({ mode: 'standalone' }),
};
const adapter = (adapters[/** @type {keyof typeof adapters} */ (target)] ?? adapters.node)();

/** No Cloudflare, "@/server/platform" aponta para D1/R2/KV e mantém libSQL/sharp/fs fora do Worker. */
const platformAlias =
  target === 'cloudflare'
    ? [
        {
          find: /^@\/server\/platform$/,
          replacement: fileURLToPath(new URL('./src/server/platform/cloudflare.ts', import.meta.url)),
        },
      ]
    : [];

export default defineConfig({
  site,
  output: 'server',
  adapter,
  // Não usamos sessões do Astro (o painel tem sessão própria assinada).
  session: false,
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
  security: {
    checkOrigin: true,
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  env: {
    schema: {
      PUBLIC_SITE_URL: secret(),
      ALLOW_INDEXING: envField.boolean({ context: 'server', access: 'secret', default: false }),
      DATABASE_URL: secret({ default: 'file:.data/dev.db' }),
      DATABASE_AUTH_TOKEN: secret(),
      STORAGE_DRIVER: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['local', 'vercel-blob', 's3', 'r2', 'kv'],
        default: 'local',
      }),
      LOCAL_STORAGE_DIR: secret({ default: '.data/uploads' }),
      BLOB_READ_WRITE_TOKEN: secret(),
      S3_ENDPOINT: secret(),
      S3_BUCKET: secret(),
      S3_REGION: secret({ default: 'auto' }),
      S3_ACCESS_KEY_ID: secret(),
      S3_SECRET_ACCESS_KEY: secret(),
      AUTH_MODE: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['password', 'cloudflare-access'],
        default: 'password',
      }),
      ADMIN_PASSWORD_HASH: secret(),
      SESSION_SECRET: secret(),
      CF_ACCESS_TEAM_DOMAIN: secret(),
      CF_ACCESS_AUD: secret(),
      ADMIN_EMAILS: secret(),
      TURNSTILE_SITE_KEY: secret(),
      TURNSTILE_SECRET_KEY: secret(),
      IP_HASH_SALT: secret(),
      RESEND_API_KEY: secret(),
      LEAD_NOTIFICATION_EMAIL: secret(),
      LEAD_NOTIFICATION_FROM: secret(),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: platformAlias },
    build: {
      // Limite para embutir CSS pequeno (inlineStylesheets: 'auto'). Scripts continuam
      // sempre externos — verificado pelo teste E2E de CSP (nenhum <script> inline executável).
      assetsInlineLimit: (/** @type {string} */ file, /** @type {Buffer} */ content) =>
        /\.css($|\?)/.test(file) && content.length <= 6144,
    },
  },
  build: {
    // CSS pequenos entram inline (menos requisições bloqueantes); o CSS global continua
    // em arquivo com cache longo. A CSP permite estilos inline, nunca scripts inline.
    inlineStylesheets: 'auto',
  },
});
