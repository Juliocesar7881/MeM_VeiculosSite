import { z } from 'zod';
import { COMMERCIAL_TYPES, FUELS, TRANSMISSIONS, VEHICLE_CATEGORIES, VEHICLE_STATUSES } from '@/config/catalog';
import {
  checkbox,
  optionalEnum,
  optionalInt,
  optionalMoney,
  optionalMultiline,
  optionalText,
  optionalYear,
  requiredText,
  stateField,
} from './common';

const MAX_FEATURES = 80;

const featureList = z
  .preprocess((value) => {
    const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return list.flatMap((item) => String(item).split(/\r?\n/));
  }, z.array(z.string()))
  .transform((items) => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of items) {
      const item = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
      const key = item.toLowerCase();
      if (!item || seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result.slice(0, MAX_FEATURES);
  });

export const vehicleInputSchema = z
  .object({
    category: z.enum(VEHICLE_CATEGORIES, { error: 'Selecione a categoria.' }),
    brand: requiredText('a marca', 1, 40),
    model: requiredText('o modelo', 1, 60),
    version: optionalText('Versão', 80),
    manufactureYear: optionalYear('Ano de fabricação'),
    modelYear: optionalYear('Ano modelo'),
    price: optionalMoney('Preço'),
    previousPrice: optionalMoney('Preço anterior'),
    mileage: optionalInt('Quilometragem', 0, 3_000_000),
    usageHours: optionalInt('Horas de uso', 0, 500_000),
    fuel: optionalEnum(FUELS, 'Combustível'),
    transmission: optionalEnum(TRANSMISSIONS, 'Câmbio'),
    color: optionalText('Cor', 30),
    bodyType: optionalText('Carroceria', 40),
    city: optionalText('Cidade', 60),
    state: stateField,
    description: optionalMultiline('Descrição', 5000),
    features: featureList,
    status: z.enum(VEHICLE_STATUSES, { error: 'Status inválido.' }),
    featured: checkbox,
    isOffer: checkbox,
    commercialType: z.enum(COMMERCIAL_TYPES, { error: 'Tipo comercial inválido.' }),
  })
  .superRefine((data, ctx) => {
    if (data.manufactureYear !== null && data.modelYear !== null) {
      if (data.modelYear < data.manufactureYear || data.modelYear > data.manufactureYear + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['modelYear'],
          message: 'O ano modelo deve ser igual ou 1 ano após o ano de fabricação.',
        });
      }
    }
    if (data.isOffer && data.previousPrice !== null) {
      if (data.price === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: 'Informe o preço atual para exibir o preço anterior da oferta.',
        });
      } else if (data.previousPrice <= data.price) {
        ctx.addIssue({
          code: 'custom',
          path: ['previousPrice'],
          message: 'O preço anterior deve ser maior que o preço atual.',
        });
      }
    }
  });

export type VehicleInput = z.output<typeof vehicleInputSchema>;

export const VEHICLE_QUICK_ACTIONS = [
  'publish',
  'unpublish',
  'mark-available',
  'mark-reserved',
  'mark-sold',
  'archive',
  'feature',
  'unfeature',
  'offer-on',
  'offer-off',
  'repasse-on',
  'repasse-off',
  'delete',
] as const;
export type VehicleQuickAction = (typeof VEHICLE_QUICK_ACTIONS)[number];

export const vehicleQuickActionSchema = z.enum(VEHICLE_QUICK_ACTIONS);

export const imageOrderSchema = z.object({
  order: z.array(z.uuid()).min(1).max(100),
});
