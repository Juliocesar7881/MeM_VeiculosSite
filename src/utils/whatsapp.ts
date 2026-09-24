import type { CommercialType } from '@/config/catalog';
import { vehicleName, vehicleTitleWithYear } from './vehicle-format';
import { firstName } from './text';

/** Monta o link oficial wa.me com mensagem pré-preenchida. */
export function buildWhatsAppUrl(phoneDigits: string, message?: string): string {
  const digits = phoneDigits.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

interface VehicleMessageSource {
  brand: string;
  model: string;
  version: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  commercialType: CommercialType;
}

export function generalContactMessage(businessName: string): string {
  return `Olá! Vim pelo site da ${businessName} e gostaria de mais informações.`;
}

/** Mensagem do botão "Tenho interesse" (não inclui preço, mesmo em ofertas). */
export function vehicleInterestMessage(vehicle: VehicleMessageSource, url: string, businessName: string): string {
  const title = vehicleTitleWithYear(vehicle);
  const intro =
    vehicle.commercialType === 'repasse'
      ? `Olá! Tenho interesse neste veículo de repasse que vi no site da ${businessName} e gostaria de mais informações:`
      : `Olá! Vi este veículo no site da ${businessName} e gostaria de mais informações:`;
  return `${intro}\n\n${title}\n\n${url}`;
}

/** Mensagem para veículo vendido ("Procurando algo parecido?"). */
export function soldVehicleMessage(vehicle: VehicleMessageSource, url: string): string {
  const title = vehicleTitleWithYear(vehicle);
  return `Olá! Vi este veículo vendido no site e gostaria de saber se vocês possuem algo semelhante.\n\n${title}\n\n${url}`;
}

/** Mensagem do admin para o cliente que enviou uma proposta. */
export function leadContactMessage(lead: { name: string; brand: string; model: string }, businessName: string): string {
  return `Olá, ${firstName(lead.name)}. Aqui é da ${businessName}. Recebemos as informações do seu ${vehicleName(lead)} pelo nosso site e gostaríamos de conversar sobre o veículo.`;
}

export function financingMessage(vehicle: VehicleMessageSource, url: string): string {
  return `Olá! Gostaria de consultar as condições de financiamento para este veículo:\n\n${vehicleTitleWithYear(vehicle)}\n\n${url}`;
}

export function sellVehicleMessage(businessName: string): string {
  return `Olá! Tenho um veículo e gostaria que a ${businessName} avaliasse.`;
}
