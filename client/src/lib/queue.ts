import {
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  guessFormat,
  isBrowserPreviewable,
  isSupportedInput,
} from './constants';
import type { CompressionLevel, OutputFormat, QueuedFile } from '../types';

export interface QueueDefaults {
  targetFormat: OutputFormat;
  compression: CompressionLevel;
}

export interface PreparedQueue {
  accepted: QueuedFile[];
  problems: string[];
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function validateFile(file: File): string | null {
  if (file.size === 0) return `"${file.name}" is empty and was skipped.`;
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" is larger than ${MAX_FILE_SIZE_LABEL} and was skipped.`;
  }
  if (!isSupportedInput(guessFormat(file))) {
    return `"${file.name}" is not a supported file type.`;
  }
  return null;
}

function createQueuedFile(file: File, defaults: QueueDefaults): QueuedFile {
  const format = guessFormat(file);
  const previewUrl = isBrowserPreviewable(format) ? URL.createObjectURL(file) : undefined;

  return {
    id: makeId(),
    file,
    ...(previewUrl ? { previewUrl } : {}),
    format,
    size: file.size,
    targetFormat: defaults.targetFormat,
    compression: defaults.compression,
    overrides: { targetFormat: false, compression: false },
  };
}

export function prepareQueuedFiles(
  incoming: File[],
  currentCount: number,
  defaults: QueueDefaults,
): PreparedQueue {
  const accepted: QueuedFile[] = [];
  const problems: string[] = [];

  for (const file of incoming) {
    if (currentCount + accepted.length >= MAX_FILES) {
      problems.push(`Only the first ${MAX_FILES} files were added.`);
      break;
    }

    const problem = validateFile(file);
    if (problem) {
      problems.push(problem);
      continue;
    }

    accepted.push(createQueuedFile(file, defaults));
  }

  return { accepted, problems };
}
