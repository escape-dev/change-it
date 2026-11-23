export const IMAGE_OUTPUT_FORMATS = ['jpg', 'png', 'webp', 'avif', 'tiff'] as const;
export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];
export type OutputFormat = ImageOutputFormat | 'pdf';
export type CompressionLevel = 'low' | 'medium' | 'high';
export type PageFit = 'original' | 'a4' | 'letter';
export type InputFormat =
  | 'jpg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'heic'
  | 'heif'
  | 'tiff'
  | 'gif'
  | 'pdf';

export const COMPRESSION_LEVELS: readonly CompressionLevel[] = ['low', 'medium', 'high'];
export const OUTPUT_FORMATS: readonly OutputFormat[] = [...IMAGE_OUTPUT_FORMATS, 'pdf'];
export const PAGE_FITS: readonly PageFit[] = ['original', 'a4', 'letter'];

const INPUT_ALIASES: Record<string, InputFormat> = {
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

export function normalizeInputFormat(extOrMime: string): InputFormat | null {
  const key = extOrMime.toLowerCase().replace(/^image\//, '').replace(/^application\//, '');
  return INPUT_ALIASES[key] ?? null;
}

export function isHeicFormat(format: string): boolean {
  return format === 'heic' || format === 'heif';
}

export function isPdfFormat(format: string): boolean {
  return format === 'pdf';
}

export function normalizeOutputFormat(value: unknown): OutputFormat | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  if (normalized === 'jpeg') return 'jpg';
  if (normalized === 'tif') return 'tiff';
  return (OUTPUT_FORMATS as readonly string[]).includes(normalized) ? (normalized as OutputFormat) : null;
}

export function extForFormat(format: OutputFormat): string {
  return format;
}

export function mimeForFormat(format: OutputFormat): string {
  switch (format) {
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'tiff':
      return 'image/tiff';
    case 'pdf':
      return 'application/pdf';
  }
}
