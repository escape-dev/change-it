import fs from 'node:fs/promises';
import heicConvert from 'heic-convert';
import sharp, { type Metadata } from 'sharp';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

export interface DecodedHeic {
  buffer: Buffer;
  width: number;
  height: number;
  hasAlpha: boolean;
}

function toBuffer(decoded: ArrayBuffer | Uint8Array): Buffer {
  return Buffer.from(decoded instanceof Uint8Array ? decoded : new Uint8Array(decoded));
}

function decodeFailed(fileName?: string, cause?: unknown): ApiError {
  return new ApiError(
    415,
    'HEIC_DECODE_FAILED',
    'This HEIC/HEIF file could not be decoded. It may be corrupted or use an unsupported codec.',
    { fileName, cause },
  );
}

async function readMetadata(buffer: Buffer, fileName?: string): Promise<Metadata> {
  try {
    return await sharp(buffer).metadata();
  } catch (error) {
    throw new ApiError(422, 'INVALID_IMAGE', 'The decoded HEIC/HEIF image could not be read.', {
      fileName,
      cause: error,
    });
  }
}

export async function decodeHeic(filePath: string, fileName?: string): Promise<DecodedHeic> {
  const input = await fs.readFile(filePath);

  let decoded: ArrayBuffer | Uint8Array;
  try {
    decoded = await heicConvert({ buffer: input, format: 'PNG' });
  } catch (error) {
    throw decodeFailed(fileName, error);
  }

  const buffer = toBuffer(decoded);
  const metadata = await readMetadata(buffer, fileName);
  const { width, height } = metadata;

  if (!width || !height) {
    throw new ApiError(422, 'INVALID_IMAGE', 'The decoded HEIC/HEIF image has no readable dimensions.', {
      fileName,
    });
  }

  if (width * height > config.maxInputPixels) {
    throw new ApiError(
      422,
      'IMAGE_TOO_LARGE',
      'This HEIC/HEIF image has too many pixels to process safely. Try a smaller image.',
      { fileName },
    );
  }

  return {
    buffer,
    width,
    height,
    hasAlpha: Boolean(metadata.hasAlpha),
  };
}
