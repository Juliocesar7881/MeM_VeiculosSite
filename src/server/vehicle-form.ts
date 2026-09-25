import { FEATURE_SUGGESTIONS } from '@/config/catalog';
import { formDataToObject, toFieldErrors, type FieldErrors } from '@/schemas/common';
import { vehicleInputSchema, type VehicleInput } from '@/schemas/vehicle';
import type { VehicleDetail } from '@/types/domain';
import type { SiteSettings } from '@/types/settings';
import { isoToLocalDate } from '@/utils/dates';
import { centsToInput } from '@/utils/money';

export type FormValues = Record<string, string | string[]>;

const SUGGESTION_SET = new Set(FEATURE_SUGGESTIONS.map((f) => f.toLowerCase()));

/** Valores iniciais de um cadastro novo. */
export function emptyVehicleValues(settings: SiteSettings): FormValues {
  return {
    category: 'carro',
    status: 'available',
    // Veículo novo já vem marcado para Ofertas e Repasses; o admin desmarca o que não quiser.
    isOffer: 'on',
    commercialType: 'repasse',
    city: settings.city,
    state: settings.state,
    features: [],
    featuresExtra: '',
  };
}

/** Converte um veículo salvo nos valores "crus" do formulário de edição. */
export function vehicleToFormValues(v: VehicleDetail): FormValues {
  const values: FormValues = {
    category: v.category,
    brand: v.brand,
    model: v.model,
    version: v.version ?? '',
    manufactureYear: v.manufactureYear ? String(v.manufactureYear) : '',
    modelYear: v.modelYear ? String(v.modelYear) : '',
    price: centsToInput(v.price),
    previousPrice: centsToInput(v.previousPrice),
    mileage: v.mileage !== null ? v.mileage.toLocaleString('pt-BR') : '',
    usageHours: v.usageHours !== null ? v.usageHours.toLocaleString('pt-BR') : '',
    fuel: v.fuel ?? '',
    transmission: v.transmission ?? '',
    color: v.color ?? '',
    bodyType: v.bodyType ?? '',
    city: v.city ?? '',
    state: v.state ?? '',
    description: v.description ?? '',
    status: v.status,
    commercialType: v.commercialType,
    offerStartDate: isoToLocalDate(v.offerStartAt),
    offerEndDate: isoToLocalDate(v.offerEndAt),
    features: v.features.filter((f) => SUGGESTION_SET.has(f.toLowerCase())),
    featuresExtra: v.features.filter((f) => !SUGGESTION_SET.has(f.toLowerCase())).join('\n'),
  };
  if (v.featured) values.featured = 'on';
  if (v.isOffer) values.isOffer = 'on';
  return values;
}

export type ParsedVehicleForm =
  { ok: true; data: VehicleInput; values: FormValues } | { ok: false; errors: FieldErrors; values: FormValues };

export function parseVehicleForm(formData: FormData): ParsedVehicleForm {
  const values = formDataToObject(formData, ['features']);
  // "Repasses" é uma caixa de marcar no formulário; no banco continua o tipo comercial.
  if (!('commercialType' in values)) values.commercialType = values.isRepasse === 'on' ? 'repasse' : 'normal';
  delete values.isRepasse;
  const extra = typeof values.featuresExtra === 'string' ? values.featuresExtra : '';
  const checked = Array.isArray(values.features) ? values.features : [];
  const parsed = vehicleInputSchema.safeParse({ ...values, features: [...checked, ...extra.split(/\r?\n/)] });
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error), values };
  return { ok: true, data: parsed.data, values };
}
