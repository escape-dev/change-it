import {
  COMPRESSION_LEVELS,
  PAGE_FITS,
  normalizeOutputFormat,
  type CompressionLevel,
  type OutputFormat,
  type PageFit,
} from '../utils/formats.js';
import { ApiError } from '../utils/errors.js';

export interface ResizeOptions {
  width?: number;
  height?: number;
}

export interface FileOverride {
  targetFormat?: OutputFormat;
  compression?: CompressionLevel;
  resize?: ResizeOptions | null;
}

export interface ConvertOptions {
  targetFormat: OutputFormat;
  compression: CompressionLevel;
  pageFit: PageFit;
  resize: ResizeOptions | null;
  perFile: (FileOverride | null)[];
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  targetFormat: 'webp',
  compression: 'medium',
  pageFit: 'original',
  resize: null,
  perFile: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseResize(value: unknown): ResizeOptions | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_OPTIONS', 'Resize options must be an object with width and/or height.');
  }

  const width = value.width === undefined || value.width === null ? undefined : Number(value.width);
  const height = value.height === undefined || value.height === null ? undefined : Number(value.height);

  for (const dimension of [width, height]) {
    if (dimension !== undefined) {
      if (!Number.isInteger(dimension) || dimension < 16 || dimension > 20000) {
        throw new ApiError(
          400,
          'INVALID_OPTIONS',
          'Resize dimensions must be whole numbers between 16 and 20000 pixels.',
        );
      }
    }
  }

  if (width === undefined && height === undefined) return null;
  return {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

function parseCompression(value: unknown, fallback: CompressionLevel): CompressionLevel {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' && (COMPRESSION_LEVELS as readonly string[]).includes(value)) {
    return value as CompressionLevel;
  }
  throw new ApiError(400, 'INVALID_OPTIONS', 'Compression level must be one of: low, medium, high.');
}

function parseTarget(value: unknown, fallback: OutputFormat): OutputFormat {
  if (value === undefined || value === null) return fallback;

  if (typeof value === 'string') {
    const requested = value.toLowerCase();
    if (requested === 'heic' || requested === 'heif') {
      throw new ApiError(
        400,
        'UNSUPPORTED_OUTPUT_FORMAT',
        'HEIC/HEIF output is not supported by this build. Choose JPG, PNG, WebP, AVIF, TIFF, or PDF.',
      );
    }
    if (requested === 'gif') {
      throw new ApiError(
        400,
        'UNSUPPORTED_OUTPUT_FORMAT',
        'GIF output is not supported. Choose JPG, PNG, WebP, AVIF, TIFF, or PDF.',
      );
    }
  }

  const target = normalizeOutputFormat(value);
  if (!target) {
    throw new ApiError(
      400,
      'INVALID_OPTIONS',
      'Target format must be one of: jpg, png, webp, avif, tiff, pdf.',
    );
  }
  return target;
}

function parsePageFit(value: unknown): PageFit {
  if (value === undefined || value === null) return 'original';
  if (typeof value === 'string' && (PAGE_FITS as readonly string[]).includes(value)) {
    return value as PageFit;
  }
  throw new ApiError(400, 'INVALID_OPTIONS', 'PDF page size must be one of: original, a4, letter.');
}

function parseOverride(value: unknown): FileOverride | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_OPTIONS', 'Per-file options must be an object or null.');
  }

  const override: FileOverride = {};
  if (value.targetFormat !== undefined) override.targetFormat = parseTarget(value.targetFormat, 'webp');
  if (value.compression !== undefined) override.compression = parseCompression(value.compression, 'medium');
  if (value.resize !== undefined) override.resize = parseResize(value.resize);
  return Object.keys(override).length > 0 ? override : null;
}

export function parseOptions(raw: unknown): ConvertOptions {
  if (raw === undefined || raw === null || raw === '') return { ...DEFAULT_OPTIONS };
  if (!isRecord(raw)) {
    throw new ApiError(400, 'INVALID_OPTIONS', 'The options field must be a JSON object.');
  }

  const targetFormat = parseTarget(raw.targetFormat, DEFAULT_OPTIONS.targetFormat);
  const compression = parseCompression(raw.compression, DEFAULT_OPTIONS.compression);
  const pageFit = parsePageFit(raw.pageFit);
  const resize = parseResize(raw.resize);

  let perFile: (FileOverride | null)[] = [];
  if (raw.perFile !== undefined) {
    if (!Array.isArray(raw.perFile)) {
      throw new ApiError(400, 'INVALID_OPTIONS', 'perFile must be an array.');
    }
    if (raw.perFile.length > 20) {
      throw new ApiError(400, 'INVALID_OPTIONS', 'perFile cannot contain more than 20 entries.');
    }
    perFile = raw.perFile.map(parseOverride);
  }

  return { targetFormat, compression, pageFit, resize, perFile };
}
