import { z } from 'zod';
import { FUELS, LEAD_STATUSES, TRANSMISSIONS, VEHICLE_CATEGORIES } from '@/config/catalog';
import { normalizeBrazilPhone } from '@/utils/phone';
import {
  checkbox,
  optionalEnum,
  optionalInt,
  optionalMoney,
  optionalMultiline,
  optionalText,
  optionalYear,
  requiredText,
  requiredYear,
  stateField,
} from './common';

export const LEAD_CONSENT_TEXT =
  'Autorizo a M&M Veículos a utilizar os dados informados para entrar em contato comigo sobre este veículo.';

export const leadInputSchema = z
  .object({
    name: requiredText('seu nome', 2, 80),
    whatsapp: z.string({ error: 'Informe seu WhatsApp.' }).transform((v, ctx) => {
      const normalized = normalizeBrazilPhone(v);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Informe um WhatsApp válido com DDD.' });
        return z.NEVER;
      }
      return normalized;
    }),
    email: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v),
      z
        .email({ error: 'Informe um e-mail válido.' })
        .max(120, { error: 'E-mail muito longo.' })
        .optional()
        .transform((v) => (v ? v.toLowerCase() : null)),
    ),
    category: z.enum(VEHICLE_CATEGORIES, { error: 'Selecione a categoria.' }),
    brand: requiredText('a marca', 1, 40),
    model: requiredText('o modelo', 1, 60),
    version: optionalText('Versão', 80),
    manufactureYear: requiredYear('o ano de fabricação'),
    modelYear: optionalYear('Ano modelo'),
    mileage: optionalInt('Quilometragem', 0, 3_000_000),
    usageHours: optionalInt('Horas de uso', 0, 500_000),
    fuel: optionalEnum(FUELS, 'Combustível'),
    transmission: optionalEnum(TRANSMISSIONS, 'Câmbio'),
    color: optionalText('Cor', 30),
    city: optionalText('Cidade', 60),
    state: stateField,
    desiredPrice: optionalMoney('Preço pretendido'),
    description: optionalMultiline('Descrição', 2000),
    consent: checkbox.refine((v) => v, { error: 'É necessário autorizar o contato para enviar.' }),
    /** Honeypot: humanos não preenchem. */
    website: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.modelYear !== null && data.manufactureYear !== undefined) {
      if (data.modelYear < data.manufactureYear || data.modelYear > data.manufactureYear + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['modelYear'],
          message: 'O ano modelo deve ser igual ou 1 ano após o ano de fabricação.',
        });
      }
    }
  });

export type LeadInput = z.output<typeof leadInputSchema>;

export const leadStatusSchema = z.enum(LEAD_STATUSES);

export const leadNotesSchema = z.object({
  adminNotes: optionalMultiline('Anotações', 4000),
});
