import { performance } from 'node:perf_hooks';
import type { Job } from '../../jobs/jobStore.js';
import { saveOutput } from '../../jobs/jobStore.js';
import type { ConversionResult, IndexedError } from '../../types/api.js';
import {
  calculateSavedPercent,
  elapsedMs,
  fileDownloadUrl,
} from '../../utils/conversion.js';
import { toErrorDetail } from '../../utils/errors.js';
import type { CompressionLevel, PageFit } from '../../utils/formats.js';
import type { ConversionTask } from '../conversionPlan.js';
import { createImagePreview, encodeForPdf, prepareImageSource } from '../imageProcessor.js';
import { buildPdfFromImages, type PdfImageInput } from '../pdfProcessor.js';

export interface PdfGroupConversion {
  result: ConversionResult | null;
  failures: IndexedError[];
}

export async function convertImagesToPdf(
  tasks: ConversionTask[],
  job: Job,
  pageFit: PageFit,
): Promise<PdfGroupConversion> {
  const startedAt = performance.now();
  const images: PdfImageInput[] = [];
  const sources: string[] = [];
  const failures: IndexedError[] = [];

  let originalSize = 0;
  let previewBefore: string | undefined;
  let firstFormat = tasks[0]?.input.format ?? 'jpg';
  let compression: CompressionLevel | null = null;
  let mixedCompression = false;

  for (const task of tasks) {
    try {
      const source = await prepareImageSource(task.input.path, task.input.format, task.input.filename);
      if (!previewBefore) previewBefore = await createImagePreview(source);

      const encoded = await encodeForPdf(source, task.settings.compression, task.settings.resize);
      images.push(encoded);
      sources.push(task.input.filename);
      originalSize += task.input.size;
      firstFormat = task.input.format;

      if (compression === null) {
        compression = task.settings.compression;
      } else if (compression !== task.settings.compression) {
        mixedCompression = true;
      }
    } catch (error) {
      failures.push({
        index: task.input.index,
        ...toErrorDetail(error, task.input.filename),
      });
    }
  }

  if (images.length === 0) {
    return { result: null, failures };
  }

  const groupIndex = tasks[0]?.input.index ?? 0;

  try {
    const pdfBytes = await buildPdfFromImages(images, pageFit);
    const stored = await saveOutput(job, {
      downloadName: `change-it-${Date.now()}.pdf`,
      data: pdfBytes,
      mime: 'application/pdf',
    });

    return {
      failures,
      result: {
        id: stored.id,
        kind: 'pdf',
        fileName: stored.downloadName,
        sources,
        inputFormat: sources.length > 1 ? 'images' : firstFormat,
        outputFormat: 'pdf',
        compression: mixedCompression ? 'mixed' : (compression ?? 'medium'),
        originalSize,
        outputSize: stored.size,
        savedPercent: calculateSavedPercent(originalSize, stored.size),
        pages: images.length,
        durationMs: elapsedMs(startedAt),
        ...(previewBefore ? { previewBefore } : {}),
        downloadUrl: fileDownloadUrl(job.id, stored.id),
      },
    };
  } catch (error) {
    failures.push({ index: groupIndex, ...toErrorDetail(error) });
    return { result: null, failures };
  }
}
