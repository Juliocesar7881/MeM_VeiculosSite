export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Registro não encontrado.') {
    super(message, 404, 'not_found');
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message, 422, 'validation_error');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'conflict');
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    readonly retryAfterSeconds = 60,
  ) {
    super(message, 429, 'rate_limited');
  }
}

/** Cota diária do armazenamento de fotos esgotada (ex.: 1.000 gravações/dia no KV gratuito). */
export class StorageQuotaError extends AppError {
  constructor(
    message = 'Limite diário de envio de fotos do plano gratuito atingido. Tente novamente amanhã (a cota renova às 21h, horário de Brasília).',
  ) {
    super(message, 507, 'storage_quota');
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 503, 'misconfigured');
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
