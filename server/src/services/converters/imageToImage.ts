import { performance } from 'node:perf_hooks';
import type { Job } from '../../jobs/jobStore.js';
import { saveOutput } from '../../jobs/jobStore.js';
import type { ConversionResult } from '../../types/api.js';
import {
  calculateSavedPercent,
  elapsedMs,
  fileDownloadUrl,
  isResolutionPreserved,
} from '../../utils/conversion.js';
import { baseName } from '../../utils/files.js';
import { mimeForFormat, requireImageOutputFormat } from '../../utils/formats.js';
import type { ConversionTask } from '../conversionPlan.js';
import {
  createBufferPreview,
  createImagePreview,
  encodeImage,
  prepareImageSource,
} from '../imageProcessor.js';

export async function convertImageTask(task: ConversionTask, job: Job): Promise<ConversionResult> {
  const startedAt = performance.now();
  const target = requireImageOutputFormat(task.settings.target);
  const { input, settings } = task;

  const source = await prepareImageSource(input.path, input.format, input.filename);
  const previewBefore = await createImagePreview(source);
  const encoded = await encodeImage(source, target, settings.compression, settings.resize);
  const previewAfter = await createBufferPreview(encoded.data);

  const stored = await saveOutput(job, {
    downloadName: `${baseName(input.filename)}.${target}`,
    data: encoded.data,
    mime: mimeForFormat(target),
  });

  return {
    id: stored.id,
    kind: 'image',
    fileName: stored.downloadName,
    sources: [input.filename],
    inputFormat: input.format,
    outputFormat: target,
    compression: settings.compression,
    originalSize: input.size,
    outputSize: stored.size,
    savedPercent: calculateSavedPercent(input.size, stored.size),
    width: encoded.width,
    height: encoded.height,
    originalWidth: source.width,
    originalHeight: source.height,
    resolutionPreserved: isResolutionPreserved(
      source.width,
      source.height,
      encoded.width,
      encoded.height,
      Boolean(settings.resize),
    ),
    durationMs: elapsedMs(startedAt),
    ...(previewBefore ? { previewBefore } : {}),
    ...(previewAfter ? { previewAfter } : {}),
    downloadUrl: fileDownloadUrl(job.id, stored.id),
  };
}
