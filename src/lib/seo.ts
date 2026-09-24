import { CATEGORY_INFO, FUEL_LABELS, TRANSMISSION_LABELS } from '@/config/catalog';
import { mediaUrl } from '@/lib/storage/keys';
import type { VehicleDetail } from '@/types/domain';
import type { SiteSettings } from '@/types/settings';
import { getPriceDisplay } from '@/utils/offer';
import { vehicleFullName, yearLabel } from '@/utils/vehicle-format';

export type JsonLd = Record<string, unknown>;

export function absoluteUrl(siteUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl.replace(/\/+$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Serializa JSON-LD com escape de "<" para impedir fechamento prematuro do <script>. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
}

export function sameAs(settings: SiteSettings): string[] {
  const links: string[] = [];
  if (settings.instagram) links.push(instagramUrl(settings.instagram));
  if (settings.facebook) links.push(settings.facebook);
  return links;
}

/** Empresa: AutoDealer (subtipo de LocalBusiness). Somente dados reais cadastrados. */
export function dealerJsonLd(settings: SiteSettings, siteUrl: string): JsonLd {
  const address: JsonLd = {
    '@type': 'PostalAddress',
    addressLocality: settings.city,
    addressRegion: settings.state,
    addressCountry: 'BR',
  };
  if (settings.address) address.streetAddress = settings.address;
  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    '@id': `${siteUrl}/#empresa`,
    name: settings.businessName,
    url: siteUrl,
    logo: absoluteUrl(siteUrl, '/brand/mm-veiculos-logo.png'),
    image: absoluteUrl(siteUrl, '/og-default.jpg'),
    telephone: `+${settings.whatsapp}`,
    address,
    areaServed: { '@type': 'State', name: 'Santa Catarina' },
    sameAs: sameAs(settings),
  };
  if (settings.slogan) data.slogan = settings.slogan;
  if (settings.email) data.email = settings.email;
  return data;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], siteUrl: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(siteUrl, item.path),
    })),
  };
}

function schemaTypeFor(category: VehicleDetail['category']): string {
  if (category === 'carro') return 'Car';
  if (category === 'moto' || category === 'scooter') return 'Motorcycle';
  return 'Vehicle';
}

/** Veículo: Car/Motorcycle/Vehicle (subtipos de Product) + Offer quando há preço. */
export function vehicleJsonLd(
  vehicle: VehicleDetail,
  settings: SiteSettings,
  siteUrl: string,
  pageUrl: string,
  now: Date = new Date(),
): JsonLd {
  const name = [vehicleFullName(vehicle), yearLabel(vehicle)].filter(Boolean).join(' ');
  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': [schemaTypeFor(vehicle.category), 'Product'],
    name,
    url: pageUrl,
    brand: { '@type': 'Brand', name: vehicle.brand },
    model: vehicle.model,
    category: CATEGORY_INFO[vehicle.category].label,
    itemCondition: 'https://schema.org/UsedCondition',
    image: vehicle.images.slice(0, 8).map((img) => absoluteUrl(siteUrl, mediaUrl(img.largeKey))),
  };
  if (vehicle.description) data.description = vehicle.description.slice(0, 500);
  if (vehicle.modelYear) data.vehicleModelDate = String(vehicle.modelYear);
  if (vehicle.manufactureYear) data.productionDate = String(vehicle.manufactureYear);
  if (vehicle.mileage !== null) {
    data.mileageFromOdometer = { '@type': 'QuantitativeValue', value: vehicle.mileage, unitCode: 'KMT' };
  }
  if (vehicle.color) data.color = vehicle.color;
  if (vehicle.fuel) data.fuelType = FUEL_LABELS[vehicle.fuel];
  if (vehicle.transmission) data.vehicleTransmission = TRANSMISSION_LABELS[vehicle.transmission];
  if (vehicle.bodyType) data.bodyType = vehicle.bodyType;

  const price = getPriceDisplay(vehicle, now);
  if (price.current !== null && price.current > 0) {
    const availability =
      vehicle.status === 'sold'
        ? 'https://schema.org/SoldOut'
        : vehicle.status === 'reserved'
          ? 'https://schema.org/LimitedAvailability'
          : 'https://schema.org/InStock';
    const offer: JsonLd = {
      '@type': 'Offer',
      url: pageUrl,
      priceCurrency: 'BRL',
      price: (price.current / 100).toFixed(2),
      availability,
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@id': `${siteUrl}/#empresa`, '@type': 'AutoDealer', name: settings.businessName },
      areaServed: { '@type': 'State', name: 'Santa Catarina' },
    };
    if (vehicle.offerEndAt && price.previous !== null) offer.priceValidUntil = vehicle.offerEndAt.slice(0, 10);
    data.offers = offer;
  }
  return data;
}
