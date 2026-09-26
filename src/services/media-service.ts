import { IMAGE_LIMITS, SITE_CONSTANTS } from '@/config/site';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { isLeadImageKey, isVehicleImageKey, vehicleImageKey } from '@/lib/storage/keys';
import type { ObjectStorage, StoredObject } from '@/lib/storage/types';
import type { VehicleImageRepository } from '@/repositories/vehicle-image-repository';
import type { VehicleRepository } from '@/repositories/vehicle-repository';
import type { AdminActor, VehicleImage } from '@/types/domain';
import { ImageValidationError, inspectImage, type InspectedImage } from '@/utils/image-inspect';
import type { AuditService } from './audit-service';
import type { StorageBudget } from './storage-budget';

export interface ImagePair {
  large: Uint8Array;
  thumb: Uint8Array;
  /** Opcional: versão média (~1080 px) para celulares (gerada no navegador). */
  medium?: Uint8Array | null;
  /** Opcional: JPEG 1200x630 para compartilhamento (gerado no navegador). */
  og?: Uint8Array | null;
}

export const OG_SIZE = { width: 1200, height: 630, maxBytes: 400_000 } as const;

/** Valida a imagem de compartilhamento: JPEG real, exatamente 1200x630. */
export function validateOgImage(bytes: Uint8Array): InspectedImage {
  try {
    const og = inspectImage(bytes, { maxBytes: OG_SIZE.maxBytes, maxEdge: OG_SIZE.width, allowed: ['jpeg'] });
    if (og.width !== OG_SIZE.width || og.height !== OG_SIZE.height) {
      throw new ImageValidationError('Imagem de compartilhamento deve ter 1200×630 px.');
    }
    return og;
  } catch (error) {
    if (error instanceof ImageValidationError) throw new ValidationError(error.message);
    throw error;
  }
}

/** Valida a versão média: mesmo formato aceito, menor que a grande e com a mesma proporção. */
export function validateMediumImage(bytes: Uint8Array, large: InspectedImage): InspectedImage {
  try {
    const medium = inspectImage(bytes, {
      maxBytes: IMAGE_LIMITS.vehicleMediumMaxBytes,
      maxEdge: IMAGE_LIMITS.mediumMaxEdge + 8,
    });
    if (medium.width > large.width || medium.height > large.height) {
      throw new ImageValidationError('Versão média maior que a imagem principal.');
    }
    const ratioLarge = large.width / large.height;
    if (Math.abs(ratioLarge - medium.width / medium.height) / ratioLarge > 0.05) {
      throw new ImageValidationError('Versão média com proporção diferente da imagem principal.');
    }
    return medium;
  } catch (error) {
    if (error instanceof ImageValidationError) throw new ValidationError(error.message);
    throw error;
  }
}

export interface ValidatedPair {
  large: InspectedImage;
  thumb: InspectedImage;
}

/**
 * Valida o par (grande + miniatura) gerado no navegador.
 * O servidor NÃO confia no cliente: confere formato real, bytes, dimensões e proporção.
 */
export function validateImagePair(
  pair: ImagePair,
  limits: { largeMaxBytes: number; thumbMaxBytes: number; largeMaxEdge: number; thumbMaxEdge: number },
): ValidatedPair {
  try {
    const large = inspectImage(pair.large, {
      maxBytes: limits.largeMaxBytes,
      maxEdge: Math.min(limits.largeMaxEdge + 8, IMAGE_LIMITS.maxDimension),
    });
    const thumb = inspectImage(pair.thumb, {
      maxBytes: limits.thumbMaxBytes,
      maxEdge: limits.thumbMaxEdge + 8,
    });
    if (thumb.width > large.width || thumb.height > large.height) {
      throw new ImageValidationError('Miniatura maior que a imagem principal.');
    }
    const ratioLarge = large.width / large.height;
    const ratioThumb = thumb.width / thumb.height;
    if (Math.abs(ratioLarge - ratioThumb) / ratioLarge > 0.05) {
      throw new ImageValidationError('Miniatura com proporção diferente da imagem principal.');
    }
    // Vale em pé ou deitada: lado maior ≥ 320 e lado menor ≥ 240.
    if (Math.max(large.width, large.height) < 320 || Math.min(large.width, large.height) < 240) {
      throw new ImageValidationError('Foto muito pequena. Use imagens com pelo menos 320×240 px.');
    }
    return { large, thumb };
  } catch (error) {
    if (error instanceof ImageValidationError) throw new ValidationError(error.message);
    throw error;
  }
}

export interface MediaServiceDeps {
  storage: ObjectStorage;
  budget: StorageBudget;
  vehicles: VehicleRepository;
  images: VehicleImageRepository;
  audit: AuditService;
  idGen?: () => string;
}

export const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;

const publicVehicleCache = new Map<string, { value: boolean; expiresAt: number }>();

/** Todas as chaves de storage de uma foto (grande, média, miniatura e compartilhamento). */
export function storedKeys(image: {
  largeKey: string;
  thumbKey: string;
  mediumKey?: string | null;
  ogKey?: string | null;
}): string[] {
  return [image.largeKey, image.thumbKey, image.mediumKey, image.ogKey].filter((key): key is string => Boolean(key));
}

export class MediaService {
  private readonly idGen: () => string;

  constructor(private readonly deps: MediaServiceDeps) {
    this.idGen = deps.idGen ?? (() => crypto.randomUUID());
  }

  async addVehicleImage(vehicleId: string, pair: ImagePair, actor: AdminActor): Promise<VehicleImage> {
    const vehicle = await this.deps.vehicles.findById(vehicleId);
    if (!vehicle) throw new NotFoundError('Veículo não encontrado.');
    const count = await this.deps.images.count(vehicleId);
    if (count >= SITE_CONSTANTS.maxVehiclePhotos) {
      throw new ValidationError(`Limite de ${SITE_CONSTANTS.maxVehiclePhotos} fotos por veículo atingido.`);
    }
    const validated = validateImagePair(pair, {
      largeMaxBytes: IMAGE_LIMITS.vehicleLargeMaxBytes,
      thumbMaxBytes: IMAGE_LIMITS.vehicleThumbMaxBytes,
      largeMaxEdge: IMAGE_LIMITS.largeMaxEdge,
      thumbMaxEdge: IMAGE_LIMITS.thumbMaxEdge,
    });

    const medium = pair.medium ? validateMediumImage(pair.medium, validated.large) : null;
    const og = pair.og ? validateOgImage(pair.og) : null;
    // Todas as versões gravadas: é esse total que conta no teto do espaço de fotos.
    const totalBytes = validated.large.size + validated.thumb.size + (medium?.size ?? 0) + (og?.size ?? 0);
    await this.deps.budget.ensureRoom(totalBytes);

    const imageId = this.idGen();
    const largeKey = vehicleImageKey(vehicleId, imageId, 'large', validated.large.extension);
    const thumbKey = vehicleImageKey(vehicleId, imageId, 'thumb', validated.thumb.extension);
    const mediumKey = medium ? vehicleImageKey(vehicleId, imageId, 'medium', medium.extension) : null;
    const ogKey = og ? vehicleImageKey(vehicleId, imageId, 'og', og.extension) : null;

    await this.deps.storage.put(largeKey, pair.large, {
      contentType: validated.large.contentType,
      cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
    });
    try {
      await this.deps.storage.put(thumbKey, pair.thumb, {
        contentType: validated.thumb.contentType,
        cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
      });
      if (medium && mediumKey && pair.medium) {
        await this.deps.storage.put(mediumKey, pair.medium, {
          contentType: medium.contentType,
          cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
        });
      }
      if (og && ogKey && pair.og) {
        await this.deps.storage.put(ogKey, pair.og, {
          contentType: og.contentType,
          cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
        });
      }
      const image: VehicleImage = {
        id: imageId,
        vehicleId,
        largeKey,
        thumbKey,
        ogKey,
        mediumKey,
        mediumWidth: medium?.width ?? null,
        mediumHeight: medium?.height ?? null,
        width: validated.large.width,
        height: validated.large.height,
        thumbWidth: validated.thumb.width,
        thumbHeight: validated.thumb.height,
        contentType: validated.large.contentType,
        sizeBytes: totalBytes,
        position: await this.deps.images.nextPosition(vehicleId),
        createdAt: new Date().toISOString(),
      };
      await this.deps.images.insert(image);
      await this.deps.vehicles.touch(vehicleId, image.createdAt);
      await this.deps.audit.log(actor, 'vehicle.image.add', 'vehicle', vehicleId, { imageId });
      return image;
    } catch (error) {
      await this.deps.storage.delete(storedKeys({ largeKey, thumbKey, mediumKey, ogKey })).catch(() => undefined);
      throw error;
    }
  }

  async deleteVehicleImage(vehicleId: string, imageId: string, actor: AdminActor): Promise<void> {
    const image = await this.deps.images.findById(imageId);
    if (!image || image.vehicleId !== vehicleId) throw new NotFoundError('Foto não encontrada.');
    await this.deps.images.delete(imageId);
    await this.deps.storage.delete(storedKeys(image)).catch((error: unknown) => {
      console.error('[media] falha ao remover arquivo do storage', error);
    });
    await this.deps.vehicles.touch(vehicleId, new Date().toISOString());
    await this.deps.audit.log(actor, 'vehicle.image.delete', 'vehicle', vehicleId, { imageId });
  }

  async reorderVehicleImages(vehicleId: string, order: string[], actor: AdminActor): Promise<VehicleImage[]> {
    const current = await this.deps.images.listByVehicle(vehicleId);
    const known = new Set(current.map((i) => i.id));
    const unique = [...new Set(order)].filter((id) => known.has(id));
    // Fotos não enviadas na nova ordem vão para o final, mantendo a ordem anterior.
    const rest = current.map((i) => i.id).filter((id) => !unique.includes(id));
    await this.deps.images.reorder(vehicleId, [...unique, ...rest]);
    await this.deps.vehicles.touch(vehicleId, new Date().toISOString());
    await this.deps.audit.log(actor, 'vehicle.image.reorder', 'vehicle', vehicleId);
    return this.deps.images.listByVehicle(vehicleId);
  }

  /** Foto pública de veículo (/media/...). Chaves fora do padrão nunca chegam ao storage. */
  async getPublicVehicleObject(key: string): Promise<StoredObject | null> {
    if (!isVehicleImageKey(key)) return null;
    return this.deps.storage.get(key);
  }

  /**
   * As fotos deste veículo podem ir para qualquer visitante? Só se ele estiver publicado.
   * Rascunhos (inclusive os criados a partir de propostas, com fotos do cliente) exigem login.
   * Cache por instância: publicado 60 s, não publicado 10 s.
   */
  async isVehiclePublic(vehicleId: string): Promise<boolean> {
    const now = Date.now();
    const cached = publicVehicleCache.get(vehicleId);
    if (cached && cached.expiresAt > now) return cached.value;
    const value = await this.deps.vehicles.isPublished(vehicleId);
    if (!cached && publicVehicleCache.size >= 2000) {
      const oldest = publicVehicleCache.keys().next().value;
      if (oldest !== undefined) publicVehicleCache.delete(oldest);
    }
    publicVehicleCache.set(vehicleId, { value, expiresAt: now + (value ? 60_000 : 10_000) });
    return value;
  }

  /** Status mudou no painel (publicar, tirar do site, excluir): a próxima foto consulta o banco na hora. */
  forgetPublicStatus(vehicleId: string): void {
    publicVehicleCache.delete(vehicleId);
  }

  /** Foto de proposta — chamada somente por rota protegida do admin. */
  async getLeadObject(key: string): Promise<StoredObject | null> {
    if (!isLeadImageKey(key)) return null;
    return this.deps.storage.get(key);
  }
}
