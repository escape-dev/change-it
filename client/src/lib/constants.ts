import type { CompressionLevel, OutputFormat, PageFit } from '../types';

export const MAX_FILES = 20;
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '50 MB';
export const MIN_RESIZE_DIMENSION = 16;
export const MAX_RESIZE_DIMENSION = 20_000;

export const ACCEPT_ATTR =
  '.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tif,.tiff,.gif,.pdf,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/tiff,image/gif,application/pdf';

export const BROWSER_PREVIEW_FORMATS = ['jpg', 'png', 'webp', 'avif', 'gif'];

export const TARGET_FORMATS: { value: OutputFormat; label: string; note: string }[] = [
  { value: 'webp', label: 'WebP', note: 'Best all-round web format' },
  { value: 'jpg', label: 'JPG', note: 'Universal photo format' },
  { value: 'png', label: 'PNG', note: 'Lossless with alpha' },
  { value: 'avif', label: 'AVIF', note: 'Next-gen, smallest files' },
  { value: 'tiff', label: 'TIFF', note: 'Print and archive' },
  { value: 'pdf', label: 'PDF', note: 'Pack images into one PDF' },
];

export const COMPRESSION_LEVELS: {
  value: CompressionLevel;
  label: string;
  note: string;
  recommended?: boolean;
}[] = [
  { value: 'low', label: 'Low', note: 'Best fidelity' },
  { value: 'medium', label: 'Medium', note: 'Recommended', recommended: true },
  { value: 'high', label: 'High', note: 'Smallest files' },
];

export const PDF_PAGE_FITS: { value: PageFit; label: string }[] = [
  { value: 'original', label: 'Original size' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
];

const FORMAT_BY_EXTENSION: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  jpe: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  heic: 'heic',
  heif: 'heif',
  tif: 'tiff',
  tiff: 'tiff',
  gif: 'gif',
  pdf: 'pdf',
};

export function guessFormat(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (FORMAT_BY_EXTENSION[ext]) return FORMAT_BY_EXTENSION[ext];

  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/tiff') return 'tiff';
  if (file.type === 'image/heic') return 'heic';
  if (file.type === 'image/heif') return 'heif';
  if (file.type.startsWith('image/')) return file.type.slice('image/'.length);

  return 'unknown';
}

const SUPPORTED_INPUT_FORMATS = new Set(['jpg', 'png', 'webp', 'avif', 'heic', 'heif', 'tiff', 'gif', 'pdf']);

export function isSupportedInput(format: string): boolean {
  return SUPPORTED_INPUT_FORMATS.has(format);
}

export function isBrowserPreviewable(format: string): boolean {
  return BROWSER_PREVIEW_FORMATS.includes(format);
}
