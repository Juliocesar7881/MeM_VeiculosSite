import { IMAGE_LIMITS, SITE_CONSTANTS } from '@/config/site';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  isLeadImageKey,
  isVehicleImageKey,
  vehicleImageKey,
  type ObjectStorage,
  type StoredObject,
} from '@/lib/storage';
import type { VehicleImageRepository } from '@/repositories/vehicle-image-repository';
import type { VehicleRepository } from '@/repositories/vehicle-repository';
import type { AdminActor, VehicleImage } from '@/types/domain';
import { ImageValidationError, inspectImage, type InspectedImage } from '@/utils/image-inspect';
import type { AuditService } from './audit-service';

export interface ImagePair {
  large: Uint8Array;
  thumb: Uint8Array;
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
    if (large.width < 320 || large.height < 240) {
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
  vehicles: VehicleRepository;
  images: VehicleImageRepository;
  audit: AuditService;
  idGen?: () => string;
}

export const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;

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

    const imageId = this.idGen();
    const largeKey = vehicleImageKey(vehicleId, imageId, 'large', validated.large.extension);
    const thumbKey = vehicleImageKey(vehicleId, imageId, 'thumb', validated.thumb.extension);

    await this.deps.storage.put(largeKey, pair.large, {
      contentType: validated.large.contentType,
      cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
    });
    try {
      await this.deps.storage.put(thumbKey, pair.thumb, {
        contentType: validated.thumb.contentType,
        cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
      });
      const image: VehicleImage = {
        id: imageId,
        vehicleId,
        largeKey,
        thumbKey,
        width: validated.large.width,
        height: validated.large.height,
        thumbWidth: validated.thumb.width,
        thumbHeight: validated.thumb.height,
        contentType: validated.large.contentType,
        sizeBytes: validated.large.size + validated.thumb.size,
        position: await this.deps.images.nextPosition(vehicleId),
        createdAt: new Date().toISOString(),
      };
      await this.deps.images.insert(image);
      await this.deps.vehicles.touch(vehicleId, image.createdAt);
      await this.deps.audit.log(actor, 'vehicle.image.add', 'vehicle', vehicleId, { imageId });
      return image;
    } catch (error) {
      await this.deps.storage.delete([largeKey, thumbKey]).catch(() => undefined);
      throw error;
    }
  }

  async deleteVehicleImage(vehicleId: string, imageId: string, actor: AdminActor): Promise<void> {
    const image = await this.deps.images.findById(imageId);
    if (!image || image.vehicleId !== vehicleId) throw new NotFoundError('Foto não encontrada.');
    await this.deps.images.delete(imageId);
    await this.deps.storage.delete([image.largeKey, image.thumbKey]).catch((error: unknown) => {
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

  /** Foto de proposta — chamada somente por rota protegida do admin. */
  async getLeadObject(key: string): Promise<StoredObject | null> {
    if (!isLeadImageKey(key)) return null;
    return this.deps.storage.get(key);
  }
}
