import { MAX_RESIZE_DIMENSION, MIN_RESIZE_DIMENSION } from './constants';
import type {
  CompressionLevel,
  ConvertOptionsPayload,
  FileOverridePayload,
  OutputFormat,
  PageFit,
  QueuedFile,
  ResizeOptions,
} from '../types';

export interface ConversionPayloadInput {
  files: QueuedFile[];
  globalTarget: OutputFormat;
  globalCompression: CompressionLevel;
  pageFit: PageFit;
  resizeEnabled: boolean;
  resizeWidth: string;
  resizeHeight: string;
}

export type ConversionPayloadResult =
  | { ok: true; payload: ConvertOptionsPayload }
  | { ok: false; message: string };

function parseDimension(raw: string): number | undefined | null {
  if (raw.trim() === '') return undefined;

  const value = Number(raw);
  const isValid =
    Number.isInteger(value) &&
    value >= MIN_RESIZE_DIMENSION &&
    value <= MAX_RESIZE_DIMENSION;

  return isValid ? value : null;
}

function buildFileOverride(file: QueuedFile): FileOverridePayload | null {
  const override: FileOverridePayload = {};

  if (file.overrides.targetFormat) override.targetFormat = file.targetFormat;
  if (file.overrides.compression) override.compression = file.compression;

  return Object.keys(override).length > 0 ? override : null;
}

function findPdfTargetingPdf(files: QueuedFile[]): QueuedFile | undefined {
  return files.find((file) => file.format === 'pdf' && file.targetFormat === 'pdf');
}

export function buildConversionPayload(input: ConversionPayloadInput): ConversionPayloadResult {
  const pdfToPdf = findPdfTargetingPdf(input.files);
  if (pdfToPdf) {
    return {
      ok: false,
      message: `"${pdfToPdf.file.name}" is a PDF. Choose JPG, PNG, WebP, AVIF, or TIFF as its target to render its pages.`,
    };
  }

  const width = parseDimension(input.resizeWidth);
  const height = parseDimension(input.resizeHeight);

  if (width === null || height === null) {
    return {
      ok: false,
      message: `Resize dimensions must be whole numbers between ${MIN_RESIZE_DIMENSION} and ${MAX_RESIZE_DIMENSION} px.`,
    };
  }

  if (input.resizeEnabled && width === undefined && height === undefined) {
    return {
      ok: false,
      message: 'Enter a width or height to use resize, or turn resize off.',
    };
  }

  const resize: ResizeOptions | null =
    input.resizeEnabled && (width !== undefined || height !== undefined)
      ? {
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
        }
      : null;

  return {
    ok: true,
    payload: {
      targetFormat: input.globalTarget,
      compression: input.globalCompression,
      pageFit: input.pageFit,
      resize,
      perFile: input.files.map(buildFileOverride),
    },
  };
}
