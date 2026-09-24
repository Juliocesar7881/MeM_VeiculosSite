import { describe, expect, it } from 'vitest';
import { formatBrazilPhone, normalizeBrazilPhone, telHref } from '@/utils/phone';
import { buildWhatsAppUrl, leadContactMessage, soldVehicleMessage, vehicleInterestMessage } from '@/utils/whatsapp';

const vehicle = {
  brand: 'Toyota',
  model: 'Corolla',
  version: 'XEi 2.0',
  manufactureYear: 2021,
  modelYear: 2022,
  commercialType: 'normal' as const,
};
const url = 'https://exemplo.com.br/veiculo/toyota-corolla-xei-2-0-2022-abc123';

describe('buildWhatsAppUrl', () => {
  it('usa o número oficial e codifica a mensagem', () => {
    const link = buildWhatsAppUrl('554896410338', 'Olá! Tudo bem?');
    expect(link).toBe('https://wa.me/554896410338?text=Ol%C3%A1!%20Tudo%20bem%3F');
  });
  it('remove caracteres não numéricos do telefone', () => {
    expect(buildWhatsAppUrl('+55 (48) 9641-0338')).toBe('https://wa.me/554896410338');
  });
});

describe('mensagens', () => {
  it('interesse em veículo normal inclui título e URL, sem preço', () => {
    const msg = vehicleInterestMessage(vehicle, url, 'M&M Veículos');
    expect(msg).toBe(
      `Olá! Vi este veículo no site da M&M Veículos e gostaria de mais informações:\n\nToyota Corolla XEi 2.0 2021/2022\n\n${url}`,
    );
    expect(msg).not.toMatch(/R\$/);
  });

  it('interesse em repasse menciona repasse', () => {
    const msg = vehicleInterestMessage({ ...vehicle, commercialType: 'repasse' }, url, 'M&M Veículos');
    expect(msg.startsWith('Olá! Tenho interesse neste veículo de repasse')).toBe(true);
  });

  it('veículo vendido pergunta por algo semelhante', () => {
    expect(soldVehicleMessage(vehicle, url)).toContain(
      'Olá! Vi este veículo vendido no site e gostaria de saber se vocês possuem algo semelhante.',
    );
  });

  it('contato do admin com o cliente usa o primeiro nome', () => {
    expect(leadContactMessage({ name: 'João da Silva', brand: 'Fiat', model: 'Uno' }, 'M&M Veículos')).toBe(
      'Olá, João. Aqui é da M&M Veículos. Recebemos as informações do seu Fiat Uno pelo nosso site e gostaríamos de conversar sobre o veículo.',
    );
  });
});

describe('telefone brasileiro', () => {
  it.each([
    ['(47) 99999-8888', '5547999998888'],
    ['47999998888', '5547999998888'],
    ['+55 47 99999-8888', '5547999998888'],
    ['4833334444', '554833334444'],
    ['554896410338', '554896410338'],
  ])('normaliza %s', (input, expected) => {
    expect(normalizeBrazilPhone(input)).toBe(expected);
  });

  it.each(['123', '0047999998888123', '+1 555 123 4567', ''])('rejeita %s', (input) => {
    expect(normalizeBrazilPhone(input)).toBeNull();
  });

  it('formata para exibição', () => {
    expect(formatBrazilPhone('5547999998888')).toBe('(47) 99999-8888');
    expect(formatBrazilPhone('554896410338')).toBe('(48) 9641-0338');
    expect(telHref('+55 48 9641-0338')).toBe('tel:+554896410338');
  });
});
