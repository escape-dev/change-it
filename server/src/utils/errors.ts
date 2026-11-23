export interface ErrorDetail {
  code: string;
  message: string;
  fileName?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fileName?: string;
  readonly details?: ErrorDetail[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: { fileName?: string; details?: ErrorDetail[]; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.fileName = options.fileName;
    this.details = options.details;
  }
}

export function toErrorDetail(error: unknown, fallbackFileName?: string): ErrorDetail {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.fileName ?? fallbackFileName ? { fileName: error.fileName ?? fallbackFileName } : {}),
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown processing error';

  if (/heic|heif/i.test(message)) {
    return {
      code: 'HEIC_DECODE_FAILED',
      message:
        'This HEIC/HEIF file could not be decoded. It may be corrupted or use an unsupported codec.',
      fileName: fallbackFileName,
    };
  }

  if (/pdf/i.test(message)) {
    return {
      code: 'PDF_PROCESSING_FAILED',
      message:
        'This PDF could not be processed. It may be corrupted, password-protected, or unsupported.',
      fileName: fallbackFileName,
    };
  }

  if (/unsupported image format|Input (file|buffer) is missing|corrupt|premature end/i.test(message)) {
    return {
      code: 'INVALID_IMAGE',
      message: 'This image could not be read. It may be corrupted or use an unsupported codec.',
      fileName: fallbackFileName,
    };
  }

  return {
    code: 'PROCESSING_FAILED',
    message: 'Something went wrong while processing this file. Please try again.',
    fileName: fallbackFileName,
  };
}
