import { describe, expect, it } from 'vitest';
import { centsToInput, formatBRL, parseBRLToCents, reaisToCents } from '@/utils/money';

// Intl usa espaço não separável entre "R$" e o número; \s também o reconhece.
const nbsp = (s: string) => s.replace(/\s/g, ' ');

describe('formatBRL', () => {
  it('formata sem centavos quando inteiro', () => {
    expect(nbsp(formatBRL(8_990_000))).toBe('R$ 89.900');
  });
  it('mostra centavos quando existem', () => {
    expect(nbsp(formatBRL(8_990_050))).toBe('R$ 89.900,50');
  });
});

describe('parseBRLToCents', () => {
  it.each([
    ['89.900', 8_990_000],
    ['89900', 8_990_000],
    ['89.900,50', 8_990_050],
    ['R$ 89.900,00', 8_990_000],
    ['89900,5', 8_990_050],
    ['1.234.567', 123_456_700],
    ['89900.5', 8_990_050],
  ])('"%s" -> %i', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it('vazio vira null', () => {
    expect(parseBRLToCents('')).toBeNull();
    expect(parseBRLToCents('   ')).toBeNull();
    expect(parseBRLToCents(null)).toBeNull();
  });

  it.each(['abc', '12,34,56', '1.23.4', '-100', '10,999'])('"%s" é inválido', (input) => {
    expect(Number.isNaN(parseBRLToCents(input))).toBe(true);
  });
});

describe('centsToInput / reaisToCents', () => {
  it('ida e volta', () => {
    expect(centsToInput(8_990_000)).toBe('89.900');
    expect(centsToInput(8_990_050)).toBe('89.900,50');
    expect(parseBRLToCents(centsToInput(12_345_678))).toBe(12_345_678);
    expect(centsToInput(null)).toBe('');
  });
  it('reais inteiros para centavos', () => {
    expect(reaisToCents(50_000)).toBe(5_000_000);
  });
});
