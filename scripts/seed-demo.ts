/**
 * Popula o banco LOCAL com veículos de DEMONSTRAÇÃO para avaliar o layout.
 * - Recusa rodar contra bancos remotos (produção/Turso).
 * - Todos os registros são marcados como demonstração na descrição.
 * - Fotos são ilustrações geradas, identificadas como "FOTO DEMONSTRATIVA".
 *
 * Uso: npm run db:seed:demo
 */
import sharp from 'sharp';
import { createLibsqlDatabase } from '../src/lib/db/libsql';
import { LocalStorage } from '../src/lib/storage/local';
import { vehicleInputSchema } from '../src/schemas/vehicle';
import { buildServices } from '../src/server/services';
import type { AdminActor } from '../src/types/domain';
import { demoPhotoSvg, type DemoShape } from './lib/demo-art';
import { isLocalDatabase, loadEnv } from './lib/env';

interface DemoVehicle {
  shape: DemoShape;
  color: string;
  photos: number;
  data: Record<string, string | string[]>;
  lead?: boolean;
}

const actor: AdminActor = { id: 'seed', label: 'Seed de demonstração', method: 'password' };
const DEMO_NOTE =
  'VEÍCULO DE DEMONSTRAÇÃO — dados e fotos fictícios, usados apenas para avaliar o layout em ambiente local.';

function iso(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const VEHICLES: DemoVehicle[] = [
  {
    shape: 'sedan',
    color: '#9ca3ab',
    photos: 5,
    data: {
      category: 'carro',
      brand: 'Toyota',
      model: 'Corolla',
      version: 'XEi 2.0 Flex',
      manufactureYear: '2021',
      modelYear: '2022',
      price: '118.900',
      previousPrice: '124.900',
      mileage: '42.300',
      fuel: 'flex',
      transmission: 'cvt',
      color: 'Prata',
      bodyType: 'Sedã',
      city: 'Massaranduba',
      state: 'SC',
      status: 'available',
      featured: 'on',
      isOffer: 'on',
      offerEndDate: iso(20),
      commercialType: 'normal',
      published: 'on',
      features: [
        'Ar-condicionado digital',
        'Multimídia',
        'Câmera de ré',
        'Bancos de couro',
        'Chave presencial',
        'Piloto automático',
      ],
    },
  },
  {
    shape: 'hatch',
    color: '#b91c1c',
    photos: 4,
    data: {
      category: 'carro',
      brand: 'Volkswagen',
      model: 'Polo',
      version: 'Highline 200 TSI',
      manufactureYear: '2020',
      modelYear: '2021',
      price: '89.900',
      mileage: '51.000',
      fuel: 'flex',
      transmission: 'automatico',
      color: 'Vermelho',
      bodyType: 'Hatch',
      city: 'Massaranduba',
      state: 'SC',
      status: 'available',
      featured: 'on',
      commercialType: 'normal',
      published: 'on',
      features: ['Ar-condicionado', 'Direção elétrica', 'Android Auto / Apple CarPlay', 'Rodas de liga leve'],
    },
  },
  {
    shape: 'suv',
    color: '#1f2937',
    photos: 6,
    data: {
      category: 'carro',
      brand: 'Jeep',
      model: 'Compass',
      version: 'Longitude 1.3 T270',
      manufactureYear: '2022',
      modelYear: '2022',
      price: '149.900',
      mileage: '28.700',
      fuel: 'flex',
      transmission: 'automatico',
      color: 'Preto',
      bodyType: 'SUV',
      city: 'Guaramirim',
      state: 'SC',
      status: 'reserved',
      featured: 'on',
      commercialType: 'normal',
      published: 'on',
      features: ['Teto solar', 'Faróis de LED', 'Controle de estabilidade', 'Multimídia'],
    },
  },
  {
    shape: 'pickup',
    color: '#e5e7eb',
    photos: 4,
    data: {
      category: 'carro',
      brand: 'Fiat',
      model: 'Strada',
      version: 'Freedom 1.3 Cabine Dupla',
      manufactureYear: '2021',
      modelYear: '2021',
      price: '84.500',
      mileage: '63.100',
      fuel: 'flex',
      transmission: 'manual',
      color: 'Branco',
      bodyType: 'Picape',
      city: 'Massaranduba',
      state: 'SC',
      status: 'available',
      commercialType: 'repasse',
      published: 'on',
      features: ['Protetor de caçamba', 'Ar-condicionado', 'Direção elétrica'],
    },
  },
  {
    shape: 'hatch',
    color: '#1d4ed8',
    photos: 3,
    data: {
      category: 'carro',
      brand: 'Chevrolet',
      model: 'Onix',
      version: 'LT 1.0 Turbo',
      manufactureYear: '2020',
      modelYear: '2020',
      price: '62.900',
      previousPrice: '66.500',
      mileage: '78.400',
      fuel: 'flex',
      transmission: 'manual',
      color: 'Azul',
      bodyType: 'Hatch',
      city: 'Jaraguá do Sul',
      state: 'SC',
      status: 'available',
      isOffer: 'on',
      commercialType: 'repasse',
      published: 'on',
      features: ['Multimídia', 'Ar-condicionado'],
    },
  },
  {
    shape: 'sedan',
    color: '#111827',
    photos: 4,
    data: {
      category: 'carro',
      brand: 'Honda',
      model: 'Civic',
      version: 'EXL 2.0 CVT',
      manufactureYear: '2019',
      modelYear: '2019',
      price: '109.900',
      mileage: '69.000',
      fuel: 'flex',
      transmission: 'cvt',
      color: 'Preto',
      bodyType: 'Sedã',
      city: 'Massaranduba',
      state: 'SC',
      status: 'sold',
      commercialType: 'normal',
      published: 'on',
      features: ['Bancos de couro', 'Multimídia'],
    },
  },
  {
    shape: 'moto',
    color: '#dc2626',
    photos: 3,
    data: {
      category: 'moto',
      brand: 'Honda',
      model: 'CG 160',
      version: 'Titan',
      manufactureYear: '2023',
      modelYear: '2023',
      price: '17.900',
      mileage: '8.200',
      fuel: 'flex',
      transmission: 'manual',
      color: 'Vermelho',
      bodyType: 'Street',
      city: 'Massaranduba',
      state: 'SC',
      status: 'available',
      featured: 'on',
      commercialType: 'normal',
      published: 'on',
      features: ['Freios ABS', 'Partida por botão', 'Manual e chave reserva'],
    },
  },
  {
    shape: 'scooter',
    color: '#e5e7eb',
    photos: 3,
    data: {
      category: 'scooter',
      brand: 'Yamaha',
      model: 'NMax 160',
      version: 'ABS Connected',
      manufactureYear: '2022',
      modelYear: '2023',
      price: '19.400',
      previousPrice: '20.900',
      mileage: '11.500',
      fuel: 'gasolina',
      transmission: 'cvt',
      color: 'Branco',
      bodyType: 'Scooter',
      city: 'Massaranduba',
      state: 'SC',
      status: 'available',
      isOffer: 'on',
      commercialType: 'normal',
      published: 'on',
      features: ['Freios ABS', 'Chave presencial'],
    },
  },
  {
    shape: 'truck',
    color: '#f3f4f6',
    photos: 3,
    data: {
      category: 'pesado',
      brand: 'Mercedes-Benz',
      model: 'Accelo 1016',
      version: 'Baú',
      manufactureYear: '2018',
      modelYear: '2018',
      price: '189.000',
      mileage: '210.000',
      fuel: 'diesel',
      transmission: 'manual',
      color: 'Branco',
      bodyType: 'Caminhão',
      city: 'Blumenau',
      state: 'SC',
      status: 'available',
      commercialType: 'repasse',
      published: 'on',
      features: ['Ar-condicionado', 'Direção hidráulica'],
    },
  },
  {
    shape: 'tractor',
    color: '#b91c1c',
    photos: 3,
    data: {
      category: 'maquina_agricola',
      brand: 'Massey Ferguson',
      model: '4275',
      version: '4x4',
      manufactureYear: '2015',
      modelYear: '2015',
      price: '139.000',
      usageHours: '4.850',
      fuel: 'diesel',
      transmission: 'manual',
      color: 'Vermelho',
      bodyType: 'Trator',
      city: 'Massaranduba',
      state: 'SC',
      status: 'available',
      featured: 'on',
      commercialType: 'normal',
      published: 'on',
      features: ['4x4', 'Engate'],
    },
  },
  {
    shape: 'suv',
    color: '#6b7280',
    photos: 2,
    data: {
      category: 'carro',
      brand: 'Hyundai',
      model: 'Creta',
      version: 'Limited 1.0 Turbo',
      manufactureYear: '2023',
      modelYear: '2024',
      price: '',
      mileage: '9.800',
      fuel: 'flex',
      transmission: 'automatico',
      color: 'Cinza',
      bodyType: 'SUV',
      city: 'Massaranduba',
      state: 'SC',
      status: 'draft',
      commercialType: 'normal',
      features: [],
    },
  },
];

async function makePair(svg: string, maxLarge: number) {
  const base = sharp(Buffer.from(svg));
  const large = await base.clone().resize({ width: maxLarge }).webp({ quality: 80 }).toBuffer();
  const thumb = await base.clone().resize({ width: 720 }).webp({ quality: 76 }).toBuffer();
  return { large: new Uint8Array(large), thumb: new Uint8Array(thumb) };
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL || 'file:.data/dev.db';
  if (!isLocalDatabase(url)) {
    console.error('✖ O seed de demonstração só pode rodar no banco LOCAL (file:). Abortado.');
    process.exit(1);
  }
  const db = await createLibsqlDatabase({ url });
  const storage = new LocalStorage(process.env.LOCAL_STORAGE_DIR || '.data/uploads');
  const services = buildServices({ db, storage, ipHashSalt: 'seed' });

  const existing = await db.first<{ total: number }>('SELECT COUNT(*) AS total FROM vehicles');
  if (Number(existing?.total ?? 0) > 0 && !process.argv.includes('--force')) {
    console.log('O banco local já possui veículos. Use "npm run db:reset" para recomeçar ou passe --force.');
    await db.close();
    return;
  }

  for (const item of VEHICLES) {
    const parsed = vehicleInputSchema.safeParse({ ...item.data, description: DEMO_NOTE });
    if (!parsed.success) {
      console.error('Dados inválidos no seed:', item.data.model, parsed.error.issues);
      continue;
    }
    const vehicle = await services.vehicles.create(parsed.data, actor);
    for (let i = 0; i < item.photos; i += 1) {
      const svg = demoPhotoSvg({
        shape: item.shape,
        color: item.color,
        label: `${item.data.brand} ${item.data.model} — imagem ${i + 1}`,
        variant: i,
      });
      await services.media.addVehicleImage(vehicle.id, await makePair(svg, 1600), actor);
    }
    console.log(`✔ ${vehicle.brand} ${vehicle.model} (${vehicle.status})`);
  }

  // Duas propostas de exemplo (uma com fotos)
  const leadPhotos = [];
  for (let i = 0; i < 3; i += 1) {
    leadPhotos.push(
      await makePair(
        demoPhotoSvg({ shape: 'hatch', color: '#475569', label: `Proposta demonstrativa ${i + 1}`, variant: i }),
        1600,
      ),
    );
  }
  await services.leads.submit(
    {
      name: 'Cliente Demonstração',
      whatsapp: '5547999990000',
      email: null,
      category: 'carro',
      brand: 'Renault',
      model: 'Sandero',
      version: 'Expression 1.0',
      manufactureYear: 2018,
      modelYear: 2019,
      mileage: 72000,
      usageHours: null,
      fuel: 'flex',
      transmission: 'manual',
      color: 'Cinza',
      city: 'Massaranduba',
      state: 'SC',
      desiredPrice: 4_200_000,
      description: 'Proposta de demonstração gerada pelo seed local.',
      consent: true,
      website: undefined,
    },
    leadPhotos,
    { ipHash: null },
  );
  await services.leads.submit(
    {
      name: 'Outro Cliente Demo',
      whatsapp: '5547988887777',
      email: 'demo@example.com',
      category: 'moto',
      brand: 'Yamaha',
      model: 'Fazer 250',
      version: null,
      manufactureYear: 2020,
      modelYear: 2020,
      mileage: 25000,
      usageHours: null,
      fuel: 'gasolina',
      transmission: 'manual',
      color: 'Azul',
      city: 'Guaramirim',
      state: 'SC',
      desiredPrice: null,
      description: null,
      consent: true,
      website: undefined,
    },
    [],
    { ipHash: null },
  );
  console.log('✔ 2 propostas de demonstração');
  await db.close();
  console.log('\nPronto! Rode "npm run dev" e acesse http://localhost:4321');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
