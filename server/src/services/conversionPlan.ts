import { fileTypeFromFile } from 'file-type';
import type { IndexedError } from '../types/api.js';
import {
  isPdfFormat,
  normalizeInputFormat,
  type CompressionLevel,
  type InputFormat,
  type OutputFormat,
} from '../utils/formats.js';
import type { ConvertOptions, ResizeOptions } from './options.js';
import type { UploadedFile } from './uploadService.js';

export const UNSUPPORTED_INPUT_MESSAGE =
  'This file type is not supported. Use JPG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, GIF, or PDF.';

export interface DetectedInput extends UploadedFile {
  format: InputFormat;
}

export interface ResolvedSettings {
  target: OutputFormat;
  compression: CompressionLevel;
  resize: ResizeOptions | null;
}

export interface ConversionTask {
  input: DetectedInput;
  settings: ResolvedSettings;
}

export interface ConversionPlan {
  imageTasks: ConversionTask[];
  pdfInputTasks: ConversionTask[];
  pdfGroupTasks: ConversionTask[];
}

async function detectFormat(filePath: string): Promise<InputFormat | null> {
  try {
    const fileType = await fileTypeFromFile(filePath);
    return fileType ? normalizeInputFormat(fileType.ext) : null;
  } catch {
    return null;
  }
}

export async function detectInputs(
  uploads: UploadedFile[],
  errors: IndexedError[],
): Promise<DetectedInput[]> {
  const inputs: DetectedInput[] = [];

  for (const upload of uploads) {
    const format = await detectFormat(upload.path);

    if (!format) {
      errors.push({
        index: upload.index,
        code: 'UNSUPPORTED_TYPE',
        message: UNSUPPORTED_INPUT_MESSAGE,
        fileName: upload.filename,
      });
      continue;
    }

    inputs.push({ ...upload, format });
  }

  return inputs;
}

export function resolveSettings(index: number, options: ConvertOptions): ResolvedSettings {
  const override = options.perFile[index] ?? null;

  return {
    target: override?.targetFormat ?? options.targetFormat,
    compression: override?.compression ?? options.compression,
    resize: override?.resize !== undefined ? override.resize : options.resize,
  };
}

export function planConversions(
  inputs: DetectedInput[],
  options: ConvertOptions,
  errors: IndexedError[],
): ConversionPlan {
  const plan: ConversionPlan = {
    imageTasks: [],
    pdfInputTasks: [],
    pdfGroupTasks: [],
  };

  for (const input of inputs) {
    const settings = resolveSettings(input.index, options);
    const task: ConversionTask = { input, settings };

    if (isPdfFormat(input.format)) {
      if (settings.target === 'pdf') {
        errors.push({
          index: input.index,
          code: 'PDF_TO_PDF_UNSUPPORTED',
          message:
            'PDF input cannot be converted to PDF. Choose JPG, PNG, WebP, AVIF, or TIFF to render its pages.',
          fileName: input.filename,
        });
      } else {
        plan.pdfInputTasks.push(task);
      }
      continue;
    }

    if (settings.target === 'pdf') {
      plan.pdfGroupTasks.push(task);
    } else {
      plan.imageTasks.push(task);
    }
  }

  return plan;
}
