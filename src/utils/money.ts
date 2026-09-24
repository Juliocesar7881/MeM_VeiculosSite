import type { Cents } from '@/types/domain';

const BRL_WHOLE = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const BRL_CENTS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat('pt-BR');

/** Formata centavos como moeda brasileira. Oculta centavos quando zerados. */
export function formatBRL(cents: Cents): string {
  if (!Number.isFinite(cents)) return '';
  const hasCents = cents % 100 !== 0;
  const value = cents / 100;
  // Intl usa espaço não separável (U+00A0) entre "R$" e o número — mantemos para não quebrar linha.
  return hasCents ? BRL_CENTS.format(value) : BRL_WHOLE.format(value);
}

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/**
 * Converte um valor digitado em reais para centavos.
 * Aceita: "89.900", "89900", "89.900,50", "R$ 89.900,00", "89900,5", "1.234.567".
 * Retorna null para vazio e NaN para valores inválidos.
 */
export function parseBRLToCents(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : Number.NaN;
  }
  let raw = input.replace(/R\$/gi, '').replace(/\s/g, '');
  if (raw === '') return null;
  if (!/^[0-9.,]+$/.test(raw)) return Number.NaN;

  if (raw.includes(',')) {
    // Formato brasileiro: "." milhar, "," decimal
    if ((raw.match(/,/g) ?? []).length > 1) return Number.NaN;
    const [intPart = '', decPart = ''] = raw.split(',');
    if (intPart.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(intPart)) return Number.NaN;
    if (decPart.length > 2) return Number.NaN;
    raw = `${intPart.replace(/\./g, '')}.${decPart.padEnd(2, '0')}`;
  } else if (raw.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      raw = raw.replace(/\./g, '');
    } else if (/^\d+\.\d{1,2}$/.test(raw)) {
      // "89900.5" -> decimal com ponto
    } else {
      return Number.NaN;
    }
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return Number.NaN;
  return Math.round(value * 100);
}

/** Valor para preencher inputs de preço: 8990000 -> "89.900" ; 8990050 -> "89.900,50". */
export function centsToInput(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  const whole = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  const wholeStr = NUMBER.format(whole);
  return rest === 0 ? wholeStr : `${wholeStr},${String(rest).padStart(2, '0')}`;
}

/** Converte reais inteiros (filtros de URL) em centavos. */
export function reaisToCents(reais: number): Cents {
  return Math.round(reais * 100);
}
