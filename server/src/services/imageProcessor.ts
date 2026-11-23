import sharp, { type Sharp } from 'sharp';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';
import { isHeicFormat, type CompressionLevel, type ImageOutputFormat } from '../utils/formats.js';
import type { ResizeOptions } from './options.js';
import { decodeHeic } from './heicProcessor.js';

const PRESETS = {
  low: {
    jpeg: { quality: 88, chromaSubsampling: '4:4:4' as const },
    webp: { quality: 88, effort: 4 },
    avif: { quality: 82, effort: 3 },
    png: { compressionLevel: 6, adaptiveFiltering: true, palette: false },
    tiff: { compression: 'lzw' as const, predictor: 'horizontal' as const },
  },
  medium: {
    jpeg: { quality: 76, chromaSubsampling: '4:2:0' as const },
    webp: { quality: 76, effort: 4 },
    avif: { quality: 68, effort: 4 },
    png: {
      compressionLevel: 8,
      adaptiveFiltering: true,
      palette: true,
      quality: 80,
      dither: 0.5,
      colours: 256,
    },
    tiff: { compression: 'deflate' as const, predictor: 'horizontal' as const },
  },
  high: {
    jpeg: { quality: 62, chromaSubsampling: '4:2:0' as const },
    webp: { quality: 62, effort: 5 },
    avif: { quality: 52, effort: 4 },
    png: {
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: true,
      quality: 65,
      colours: 128,
      dither: 1,
    },
    tiff: { compression: 'jpeg' as const, quality: 62 },
  },
} as const;

export interface ImageSource {
  path?: string;
  buffer?: Buffer;
  format: string;
  width: number;
  height: number;
  hasAlpha: boolean;
}

export interface EncodedImage {
  data: Buffer;
  width: number;
  height: number;
}

function createSharp(source: ImageSource): Sharp {
  const input = source.buffer ?? source.path;
  if (!input) throw new Error('Image source is missing');
  return sharp(input, { failOn: 'none', limitInputPixels: config.maxInputPixels });
}

export async function prepareImageSource(
  filePath: string,
  format: string,
  fileName?: string,
): Promise<ImageSource> {
  if (isHeicFormat(format)) {
    const decoded = await decodeHeic(filePath, fileName);
    return {
      buffer: decoded.buffer,
      format,
      width: decoded.width,
      height: decoded.height,
      hasAlpha: decoded.hasAlpha,
    };
  }

  try {
    const metadata = await sharp(filePath, {
      failOn: 'none',
      limitInputPixels: config.maxInputPixels,
    }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new ApiError(422, 'INVALID_IMAGE', 'This image has no readable dimensions.', { fileName });
    }

    return {
      path: filePath,
      format,
      width: metadata.width,
      height: metadata.height,
      hasAlpha: Boolean(metadata.hasAlpha),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      422,
      'INVALID_IMAGE',
      'This image could not be read. It may be corrupted or use an unsupported codec.',
      { fileName, cause: error },
    );
  }
}

function applyResize(pipeline: Sharp, resize: ResizeOptions | null | undefined): Sharp {
  if (!resize) return pipeline;
  const { width, height } = resize;
  if (!width && !height) return pipeline;
  return pipeline.resize({
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    fit: 'inside',
    withoutEnlargement: true,
    position: 'center',
  });
}

export async function encodeImage(
  source: ImageSource,
  format: ImageOutputFormat,
  compression: CompressionLevel,
  resize?: ResizeOptions | null,
): Promise<EncodedImage> {
  const preset = PRESETS[compression];
  let pipeline = applyResize(createSharp(source), resize);

  switch (format) {
    case 'jpg':
      if (source.hasAlpha) pipeline = pipeline.flatten({ background: '#ffffff' });
      pipeline = pipeline.jpeg({
        quality: preset.jpeg.quality,
        chromaSubsampling: preset.jpeg.chromaSubsampling,
        progressive: true,
        mozjpeg: true,
      });
      break;
    case 'png':
      pipeline = pipeline.png({ ...preset.png });
      break;
    case 'webp':
      pipeline = pipeline.webp({ ...preset.webp });
      break;
    case 'avif':
      pipeline = pipeline.avif({ ...preset.avif });
      break;
    case 'tiff':
      pipeline = pipeline.tiff({ ...preset.tiff });
      break;
  }

  try {
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (error) {
    throw new ApiError(
      422,
      'ENCODE_FAILED',
      `This image could not be encoded as ${format.toUpperCase()}.`,
      { cause: error },
    );
  }
}

export async function encodeForPdf(
  source: ImageSource,
  compression: CompressionLevel,
  resize?: ResizeOptions | null,
): Promise<EncodedImage> {
  const preset = PRESETS[compression];
  let pipeline = applyResize(createSharp(source), resize);
  if (source.hasAlpha) pipeline = pipeline.flatten({ background: '#ffffff' });
  pipeline = pipeline.jpeg({
    quality: preset.jpeg.quality,
    chromaSubsampling: preset.jpeg.chromaSubsampling,
    progressive: true,
    mozjpeg: true,
  });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function toDataUrl(buffer: Buffer): Promise<string | undefined> {
  try {
    const previewBuffer = await sharp(buffer, { failOn: 'none' })
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return `data:image/webp;base64,${previewBuffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

export async function createImagePreview(source: ImageSource): Promise<string | undefined> {
  try {
    const previewBuffer = await createSharp(source)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return `data:image/webp;base64,${previewBuffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

export async function createBufferPreview(buffer: Buffer): Promise<string | undefined> {
  return toDataUrl(buffer);
}
