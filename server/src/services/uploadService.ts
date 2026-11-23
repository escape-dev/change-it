import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { MultipartFile, MultipartValue } from '@fastify/multipart';
import { config } from '../config.js';
import type { Job } from '../jobs/jobStore.js';
import { ApiError } from '../utils/errors.js';
import { parseOptions, type ConvertOptions } from './options.js';

const FILE_FIELD_NAMES = new Set(['file', 'files']);
const UPLOAD_FAILED_MESSAGE = 'The upload could not be saved. Please try again.';

export interface UploadedFile {
  index: number;
  path: string;
  filename: string;
  size: number;
}

export interface UploadRequest {
  options: ConvertOptions;
  uploads: UploadedFile[];
}

function readErrorProperty(error: unknown, key: 'code' | 'name'): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function isFileTooLarge(part: MultipartFile, error: unknown): boolean {
  return (
    part.file.truncated ||
    readErrorProperty(error, 'code') === 'FST_REQ_FILE_TOO_LARGE' ||
    readErrorProperty(error, 'name') === 'RequestFileTooLargeError'
  );
}

function fileTooLarge(filename: string): ApiError {
  return new ApiError(
    413,
    'FILE_TOO_LARGE',
    `"${filename}" is larger than ${config.maxFileSizeLabel}.`,
    { fileName: filename },
  );
}

async function saveFilePart(part: MultipartFile, job: Job, index: number): Promise<UploadedFile> {
  const filename = part.filename || `upload-${index + 1}`;
  const destinationPath = path.join(job.inputDir, `${index}-${randomUUID()}`);

  try {
    await pipeline(part.file, createWriteStream(destinationPath));
  } catch (error) {
    if (isFileTooLarge(part, error)) throw fileTooLarge(filename);
    throw new ApiError(400, 'UPLOAD_FAILED', UPLOAD_FAILED_MESSAGE, {
      fileName: filename,
      cause: error,
    });
  }

  if (part.file.truncated) throw fileTooLarge(filename);

  const stats = await fs.stat(destinationPath);
  return { index, path: destinationPath, filename, size: stats.size };
}

function readOptionsField(part: MultipartValue): unknown {
  if (typeof part.value !== 'string') return undefined;
  const raw = part.value.trim();
  if (raw === '') return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'INVALID_OPTIONS', 'The options field must contain valid JSON.');
  }
}

export async function readUploadRequest(request: FastifyRequest, job: Job): Promise<UploadRequest> {
  const uploads: UploadedFile[] = [];
  let rawOptions: unknown;
  let optionsSeen = false;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (!FILE_FIELD_NAMES.has(part.fieldname)) {
        part.file.resume();
        continue;
      }

      if (uploads.length >= config.maxFiles) {
        part.file.resume();
        throw new ApiError(
          400,
          'TOO_MANY_FILES',
          `You can upload up to ${config.maxFiles} files in a single batch.`,
          { fileName: part.filename || undefined },
        );
      }

      uploads.push(await saveFilePart(part, job, uploads.length));
      continue;
    }

    if (part.fieldname === 'options') {
      optionsSeen = true;
      rawOptions = readOptionsField(part);
    }
  }

  if (uploads.length === 0) {
    throw new ApiError(400, 'NO_FILES', 'Drop at least one file to convert.');
  }

  return {
    options: parseOptions(optionsSeen ? rawOptions : undefined),
    uploads,
  };
}
