import { z } from 'zod';
import { BRAZIL_STATES } from '@/config/catalog';
import { checkbox, optionalMultiline, optionalText, requiredText } from './common';

export const settingsInputSchema = z.object({
  businessName: requiredText('o nome da empresa', 2, 80),
  slogan: optionalText('Slogan', 160).transform((v) => v ?? ''),
  whatsapp: z
    .string({ error: 'Informe o WhatsApp.' })
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(
      z.string().regex(/^55\d{10,11}$/, { error: 'WhatsApp deve conter DDI 55 + DDD + número (ex.: 554896410338).' }),
    ),
  phone: requiredText('o telefone', 8, 30),
  instagram: z
    .string()
    .transform((v) =>
      v
        .trim()
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/^@/, '')
        .replace(/\/.*$/, ''),
    )
    .pipe(z.string().regex(/^$|^[A-Za-z0-9._]{1,30}$/, { error: 'Usuário do Instagram inválido.' })),
  facebook: z
    .string()
    .trim()
    .pipe(
      z.union([
        z.literal(''),
        z.url({
          protocol: /^https$/,
          hostname: /(^|\.)facebook\.com$/,
          error: 'Use o link completo da página do Facebook.',
        }),
      ]),
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.union([z.literal(''), z.email({ error: 'E-mail inválido.' })])),
  city: requiredText('a cidade', 2, 60),
  state: z.enum(BRAZIL_STATES, { error: 'Estado inválido.' }),
  address: optionalText('Endereço', 200).transform((v) => v ?? ''),
  openingHours: optionalMultiline('Horário de funcionamento', 400).transform((v) => v ?? ''),
  showSoldVehicles: checkbox,
  sellVehicleCta: requiredText('o texto do botão', 3, 40),
  repasseDescription: optionalMultiline('Texto sobre repasses', 1500).transform((v) => v ?? ''),
});

export type SettingsInput = z.output<typeof settingsInputSchema>;
