import type { ErrorDetail, IndexedError } from '../types/api.js';

export type { ErrorDetail } from '../types/api.js';

interface ApiErrorOptions {
  fileName?: string;
  details?: ErrorDetail[];
  cause?: unknown;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fileName?: string;
  readonly details?: ErrorDetail[];

  constructor(statusCode: number, code: string, message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fileName = options.fileName;
    this.details = options.details;
  }
}

function errorDetail(code: string, message: string, fileName?: string): ErrorDetail {
  return fileName ? { code, message, fileName } : { code, message };
}

export function toErrorDetail(error: unknown, fallbackFileName?: string): ErrorDetail {
  if (error instanceof ApiError) {
    return errorDetail(error.code, error.message, error.fileName ?? fallbackFileName);
  }

  const message = error instanceof Error ? error.message : 'Unknown processing error';

  if (/heic|heif/i.test(message)) {
    return errorDetail(
      'HEIC_DECODE_FAILED',
      'This HEIC/HEIF file could not be decoded. It may be corrupted or use an unsupported codec.',
      fallbackFileName,
    );
  }

  if (/pdf/i.test(message)) {
    return errorDetail(
      'PDF_PROCESSING_FAILED',
      'This PDF could not be processed. It may be corrupted, password-protected, or unsupported.',
      fallbackFileName,
    );
  }

  if (/unsupported image format|Input (file|buffer) is missing|corrupt|premature end/i.test(message)) {
    return errorDetail(
      'INVALID_IMAGE',
      'This image could not be read. It may be corrupted or use an unsupported codec.',
      fallbackFileName,
    );
  }

  return errorDetail(
    'PROCESSING_FAILED',
    'Something went wrong while processing this file. Please try again.',
    fallbackFileName,
  );
}

export function stripErrorIndexes(errors: IndexedError[]): ErrorDetail[] {
  return errors.map(({ index: _index, ...detail }) => detail);
}

export function isUnsupportedError(error: ErrorDetail): boolean {
  return error.code === 'UNSUPPORTED_TYPE' || error.code === 'PDF_TO_PDF_UNSUPPORTED';
}
