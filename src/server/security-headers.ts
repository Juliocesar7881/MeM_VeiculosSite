export interface SecurityHeaderOptions {
  isProduction: boolean;
  isHttps: boolean;
  noIndex: boolean;
}

/** Content Security Policy: somente recursos próprios + Cloudflare Turnstile. */
export function buildCsp(options: { isProduction: boolean; isHttps?: boolean }): string {
  const turnstile = 'https://challenges.cloudflare.com';
  const connect = ["'self'", turnstile];
  if (!options.isProduction) connect.push('ws:', 'wss:');
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${turnstile}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    `frame-src ${turnstile}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (options.isProduction && options.isHttps) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function applySecurityHeaders(headers: Headers, options: SecurityHeaderOptions): void {
  headers.set('Content-Security-Policy', buildCsp(options));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  if (options.isProduction && options.isHttps) {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  if (options.noIndex) headers.set('X-Robots-Tag', 'noindex, nofollow');
}

export const CACHE = {
  noStore: 'private, no-store, max-age=0',
  /** Páginas públicas: CDN guarda 60 s e serve versão anterior enquanto revalida. */
  publicPage: 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
  immutable: 'public, max-age=31536000, s-maxage=31536000, immutable',
  shortPublic: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
} as const;
