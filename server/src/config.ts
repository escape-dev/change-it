import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  host: process.env.HOST ?? '0.0.0.0',
  port: intFromEnv('PORT', 3000),

  tempRoot: process.env.CHANGE_IT_TMP_DIR ?? path.join(os.tmpdir(), 'change-it'),
  clientDist: path.resolve(here, '../../client/dist'),

  maxFileSize: 50 * 1024 * 1024,
  maxFileSizeLabel: '50 MB',
  maxFiles: 20,
  maxPdfPages: 50,
  maxConcurrent: intFromEnv('MAX_CONCURRENT_CONVERSIONS', 3),
  maxInputPixels: 200_000_000,
  minResizeDimension: 16,
  maxResizeDimension: 20_000,

  uploadBodyLimit: 2 * 1024 * 1024,
  uploadFieldSize: 1024 * 1024,
  maxUploadFields: 5,
  maxUploadParts: 50,

  jobTtlMs: 20 * 60 * 1000,
  cleanupCron: '*/5 * * * *',
  cleanupMaxAgeMs: 20 * 60 * 1000,

  pdfRenderDpi: 150,
  pdfMaxEdge: 4000,
} as const;

export type AppConfig = typeof config;
