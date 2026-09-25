/** Remove acentos/diacríticos. */
export function stripDiacritics(value: string): string {
  // Após NFD, os acentos viram marcas combinantes (categoria Unicode "M").
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Normaliza texto para busca: minúsculas, sem acentos, espaços simples. */
export function normalizeSearch(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9.,/+\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Divide a busca em termos úteis (máx. 6 termos, cada um com 1+ caractere). */
export function searchTerms(value: string): string[] {
  return normalizeSearch(value)
    .split(' ')
    .filter((term) => term.length > 0)
    .slice(0, 6);
}

/** Escapa caracteres especiais do LIKE (usado com ESCAPE '\'). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** O Cloudflare D1 recusa padrões de LIKE com mais de 50 bytes ("LIKE or GLOB pattern too complex"). */
export const LIKE_PATTERN_MAX_BYTES = 50;

/**
 * Padrão `%termo%` para LIKE, escapado e cortado para caber no limite do D1.
 * Um termo gigante (colado ou malicioso) só perde o fim — a busca não quebra.
 */
export function likeContains(term: string): string {
  const encoder = new TextEncoder();
  let chars = Array.from(term);
  let pattern = `%${escapeLike(chars.join(''))}%`;
  while (encoder.encode(pattern).length > LIKE_PATTERN_MAX_BYTES && chars.length > 1) {
    chars = chars.slice(0, -1);
    pattern = `%${escapeLike(chars.join(''))}%`;
  }
  return pattern;
}

/** Limpa espaços e retorna null quando vazio. */
export function cleanOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Limpa texto multilinha preservando quebras de linha (máx. 2 seguidas). */
export function cleanMultiline(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.length > 0 ? normalized : null;
}

/** Primeira letra maiúscula em cada palavra (preserva siglas já em maiúsculas). */
export function titleCaseName(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Primeiro nome, para mensagens mais pessoais. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
