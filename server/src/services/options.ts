import { config } from '../config.js';
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

const TARGET_FORMAT_MESSAGE = 'Target format must be one of: jpg, png, webp, avif, tiff, pdf.';

function invalidOptions(message: string): ApiError {
  return new ApiError(400, 'INVALID_OPTIONS', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseResizeDimension(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;

  const dimension = Number(value);
  const { minResizeDimension, maxResizeDimension } = config;

  if (
    !Number.isInteger(dimension) ||
    dimension < minResizeDimension ||
    dimension > maxResizeDimension
  ) {
    throw invalidOptions(
      `${label} must be a whole number between ${minResizeDimension} and ${maxResizeDimension} pixels.`,
    );
  }

  return dimension;
}

function parseResize(value: unknown): ResizeOptions | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) {
    throw invalidOptions('Resize options must be an object with width and/or height.');
  }

  const width = parseResizeDimension(value.width, 'Resize width');
  const height = parseResizeDimension(value.height, 'Resize height');

  return width === undefined && height === undefined
    ? null
    : {
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      };
}

function parseCompression(value: unknown, fallback: CompressionLevel): CompressionLevel {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' && (COMPRESSION_LEVELS as readonly string[]).includes(value)) {
    return value as CompressionLevel;
  }
  throw invalidOptions('Compression level must be one of: low, medium, high.');
}

function rejectUnsupportedOutput(value: string): void {
  if (value === 'heic' || value === 'heif') {
    throw new ApiError(
      400,
      'UNSUPPORTED_OUTPUT_FORMAT',
      'HEIC/HEIF output is not supported by this build. Choose JPG, PNG, WebP, AVIF, TIFF, or PDF.',
    );
  }
  if (value === 'gif') {
    throw new ApiError(
      400,
      'UNSUPPORTED_OUTPUT_FORMAT',
      'GIF output is not supported. Choose JPG, PNG, WebP, AVIF, TIFF, or PDF.',
    );
  }
}

function parseTarget(value: unknown, fallback: OutputFormat): OutputFormat {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') rejectUnsupportedOutput(value.toLowerCase());

  const target = normalizeOutputFormat(value);
  if (!target) throw invalidOptions(TARGET_FORMAT_MESSAGE);
  return target;
}

function parsePageFit(value: unknown): PageFit {
  if (value === undefined || value === null) return 'original';
  if (typeof value === 'string' && (PAGE_FITS as readonly string[]).includes(value)) {
    return value as PageFit;
  }
  throw invalidOptions('PDF page size must be one of: original, a4, letter.');
}

function parseOverride(value: unknown): FileOverride | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) {
    throw invalidOptions('Per-file options must be an object or null.');
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
    throw invalidOptions('The options field must be a JSON object.');
  }

  let perFile: (FileOverride | null)[] = [];
  if (raw.perFile !== undefined) {
    if (!Array.isArray(raw.perFile)) throw invalidOptions('perFile must be an array.');
    if (raw.perFile.length > config.maxFiles) {
      throw invalidOptions(`perFile cannot contain more than ${config.maxFiles} entries.`);
    }
    perFile = raw.perFile.map(parseOverride);
  }

  return {
    targetFormat: parseTarget(raw.targetFormat, DEFAULT_OPTIONS.targetFormat),
    compression: parseCompression(raw.compression, DEFAULT_OPTIONS.compression),
    pageFit: parsePageFit(raw.pageFit),
    resize: parseResize(raw.resize),
    perFile,
  };
}
