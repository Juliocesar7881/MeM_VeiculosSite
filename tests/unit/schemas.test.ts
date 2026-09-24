import { describe, expect, it } from 'vitest';
import { toFieldErrors } from '@/schemas/common';
import { leadInputSchema } from '@/schemas/lead';
import { settingsInputSchema } from '@/schemas/settings';
import { vehicleInputSchema } from '@/schemas/vehicle';

const validLead = {
  name: '  Maria   Souza ',
  whatsapp: '(47) 99999-8888',
  email: '',
  category: 'carro',
  brand: 'Fiat',
  model: 'Uno',
  manufactureYear: '2015',
  modelYear: '2016',
  mileage: '85.000',
  desiredPrice: '32.500',
  consent: 'on',
};

describe('leadInputSchema', () => {
  it('normaliza e converte os campos', () => {
    const r = leadInputSchema.safeParse(validLead);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.name).toBe('Maria Souza');
    expect(r.data.whatsapp).toBe('5547999998888');
    expect(r.data.email).toBeNull();
    expect(r.data.mileage).toBe(85_000);
    expect(r.data.desiredPrice).toBe(3_250_000);
    expect(r.data.version).toBeNull();
    expect(r.data.consent).toBe(true);
  });

  it('exige consentimento LGPD', () => {
    const r = leadInputSchema.safeParse({ ...validLead, consent: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).consent).toMatch(/autorizar/);
  });

  it('valida campos obrigatórios e WhatsApp', () => {
    const r = leadInputSchema.safeParse({ ...validLead, name: '', whatsapp: '123', brand: '', manufactureYear: '' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const errors = toFieldErrors(r.error);
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['name', 'whatsapp', 'brand', 'manufactureYear']));
  });

  it('valida ano modelo em relação ao ano de fabricação', () => {
    const r = leadInputSchema.safeParse({ ...validLead, modelYear: '2019' });
    expect(r.success).toBe(false);
  });

  it('rejeita e-mail inválido e ano absurdo', () => {
    expect(leadInputSchema.safeParse({ ...validLead, email: 'x@' }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...validLead, manufactureYear: '1800' }).success).toBe(false);
  });
});

const validVehicle = {
  category: 'carro',
  brand: 'Toyota',
  model: 'Corolla',
  price: '118.900',
  status: 'available',
  commercialType: 'normal',
  features: ['Ar-condicionado', 'ar-condicionado', ' ', 'Multimídia\nCâmera de ré'],
};

describe('vehicleInputSchema', () => {
  it('aceita cadastro mínimo e deduplica opcionais', () => {
    const r = vehicleInputSchema.safeParse(validVehicle);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.price).toBe(11_890_000);
    expect(r.data.features).toEqual(['Ar-condicionado', 'Multimídia', 'Câmera de ré']);
    expect(r.data.featured).toBe(false);
    expect(r.data.isOffer).toBe(false);
  });

  it('em oferta, preço anterior precisa ser maior que o atual', () => {
    const r = vehicleInputSchema.safeParse({ ...validVehicle, isOffer: 'on', previousPrice: '100.000' });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).previousPrice).toBeDefined();
    expect(vehicleInputSchema.safeParse({ ...validVehicle, isOffer: 'on', previousPrice: '124.900' }).success).toBe(
      true,
    );
  });

  it('valida período da oferta', () => {
    const r = vehicleInputSchema.safeParse({
      ...validVehicle,
      isOffer: 'on',
      offerStartDate: '2026-10-10',
      offerEndDate: '2026-10-01',
    });
    expect(r.success).toBe(false);
  });

  it('não permite arquivado publicado', () => {
    expect(vehicleInputSchema.safeParse({ ...validVehicle, status: 'archived', published: 'on' }).success).toBe(false);
  });

  it('rejeita categoria/status inexistentes', () => {
    expect(vehicleInputSchema.safeParse({ ...validVehicle, category: 'aviao' }).success).toBe(false);
    expect(vehicleInputSchema.safeParse({ ...validVehicle, status: 'perdido' }).success).toBe(false);
  });
});

describe('settingsInputSchema', () => {
  const base = {
    businessName: 'M&M Veículos',
    slogan: 'Construindo credibilidade a cada negociação.',
    whatsapp: '+55 48 9641-0338',
    phone: '+55 48 9641-0338',
    instagram: 'https://www.instagram.com/mmveiculos.sc/',
    facebook: 'https://www.facebook.com/profile.php?id=61573464239367',
    email: 'MMVEICULOS.SC@GMAIL.COM',
    city: 'Massaranduba',
    state: 'SC',
    sellVehicleCta: 'Anuncie seu veículo',
    showSoldVehicles: 'on',
  };

  it('normaliza WhatsApp, Instagram e e-mail', () => {
    const r = settingsInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.whatsapp).toBe('554896410338');
    expect(r.data.instagram).toBe('mmveiculos.sc');
    expect(r.data.email).toBe('mmveiculos.sc@gmail.com');
    expect(r.data.showSoldVehicles).toBe(true);
    expect(r.data.address).toBe('');
  });

  it('rejeita Facebook de outro domínio e WhatsApp sem DDI', () => {
    expect(settingsInputSchema.safeParse({ ...base, facebook: 'https://evil.example.com/page' }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ ...base, whatsapp: '4896410338' }).success).toBe(false);
  });
});
