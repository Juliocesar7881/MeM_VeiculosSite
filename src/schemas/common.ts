import { z } from 'zod';
import { BRAZIL_STATES } from '@/config/catalog';
import { parseBRLToCents } from '@/utils/money';
import { cleanMultiline, cleanOptional } from '@/utils/text';
import { currentYear } from '@/utils/dates';

/** Converte FormData em objeto simples. Campos repetidos (ex.: checkboxes) viram arrays. */
export function formDataToObject(
  formData: FormData,
  arrayKeys: readonly string[] = [],
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of arrayKeys) result[key] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;
    if (arrayKeys.includes(key)) {
      (result[key] as string[]).push(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const emptyToUndefined = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '') ? undefined : value;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Texto obrigatório com espaços normalizados. `label` no meio da frase: "seu nome", "a marca". */
export const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `Informe ${label}.` })
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(min, {
          error: min <= 1 ? `Informe ${label}.` : `${capitalize(label)} deve ter ao menos ${min} caracteres.`,
        })
        .max(max, { error: `${capitalize(label)} deve ter no máximo ${max} caracteres.` }),
    );

/** Texto opcional de uma linha -> string | null */
export const optionalText = (label: string, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(max * 2)
      .optional()
      .transform((v) => cleanOptional(v))
      .refine((v) => v === null || v.length <= max, {
        error: `${label} deve ter no máximo ${max} caracteres.`,
      }),
  );

/** Texto opcional multilinha -> string | null */
export const optionalMultiline = (label: string, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(max * 2)
      .optional()
      .transform((v) => cleanMultiline(v))
      .refine((v) => v === null || v.length <= max, {
        error: `${label} deve ter no máximo ${max} caracteres.`,
      }),
  );

function parseInteger(value: unknown): unknown {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/[.\s]/g, '').replace(/km|h/gi, '');
  if (cleaned === '') return undefined;
  if (!/^-?\d+$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** Inteiro opcional (aceita "45.000") -> number | null */
export const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => parseInteger(emptyToUndefined(v)),
    z
      .number({ error: `${label} inválido.` })
      .int({ error: `${label} deve ser um número inteiro.` })
      .min(min, { error: `${label} deve ser no mínimo ${min}.` })
      .max(max, { error: `${label} deve ser no máximo ${max}.` })
      .optional()
      .transform((v) => (v === undefined ? null : v)),
  );

export const requiredInt = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => parseInteger(emptyToUndefined(v)),
    z
      .number({ error: `Informe ${label}.` })
      .int({ error: `${label} deve ser um número inteiro.` })
      .min(min, { error: `${label} deve ser no mínimo ${min}.` })
      .max(max, { error: `${label} deve ser no máximo ${max}.` }),
  );

/**
 * O limite superior (ano atual + 1) é calculado NA HORA da validação: no Cloudflare Workers
 * o relógio vale 1970 enquanto o módulo é carregado (fora de uma requisição).
 */
const maxYearMessage = (label: string) => () => `${label} deve ser no máximo ${currentYear() + 1}.`;

export const requiredYear = (label: string) =>
  requiredInt(label, 1950, 9999).refine((v) => v <= currentYear() + 1, { error: maxYearMessage(label) });

export const optionalYear = (label: string) =>
  optionalInt(label, 1950, 9999).refine((v) => v === null || v <= currentYear() + 1, {
    error: maxYearMessage(label),
  });

/** Valor em reais digitado -> centavos | null */
export const optionalMoney = (label: string, maxReais = 50_000_000) =>
  z.preprocess(
    (v) => {
      const value = emptyToUndefined(v);
      if (value === undefined) return undefined;
      return parseBRLToCents(String(value));
    },
    z
      .number({ error: `${label} inválido.` })
      .refine((v) => Number.isFinite(v), { error: `${label} inválido. Use o formato 89.900 ou 89.900,00.` })
      .refine((v) => v >= 0 && v <= maxReais * 100, { error: `${label} fora do intervalo permitido.` })
      .optional()
      .transform((v) => (v === undefined ? null : v)),
  );

export const checkbox = z.preprocess(
  (v) => v === true || v === 'on' || v === 'true' || v === '1' || v === 1,
  z.boolean(),
);

export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.preprocess(
    emptyToUndefined,
    z
      .enum(values, { error: `${label} inválido.` })
      .optional()
      .transform((v) => (v === undefined ? null : v)),
  );

export const stateField = optionalEnum(BRAZIL_STATES, 'Estado');

export type FieldErrors = Record<string, string>;

/** Converte erros do Zod em { campo: primeira mensagem }. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
