import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { config } from '../../config.js';
import type { Job } from '../../jobs/jobStore.js';
import { deleteGroupFiles, saveOutput } from '../../jobs/jobStore.js';
import type { ConversionResult, ResultDownload } from '../../types/api.js';
import {
  calculateSavedPercent,
  elapsedMs,
  fileDownloadUrl,
  groupDownloadUrl,
  isResolutionPreserved,
} from '../../utils/conversion.js';
import { ApiError } from '../../utils/errors.js';
import { baseName } from '../../utils/files.js';
import { mimeForFormat, requireImageOutputFormat } from '../../utils/formats.js';
import type { ConversionTask } from '../conversionPlan.js';
import {
  createBufferPreview,
  createImagePreview,
  encodeImage,
  type ImageSource,
} from '../imageProcessor.js';
import { renderPdfPages, type RenderedPdfPage } from '../pdfProcessor.js';

function toImageSource(page: RenderedPdfPage): ImageSource {
  return {
    buffer: page.png,
    format: 'png',
    width: page.width,
    height: page.height,
    hasAlpha: false,
  };
}

export async function convertPdfTask(task: ConversionTask, job: Job): Promise<ConversionResult> {
  const startedAt = performance.now();
  const target = requireImageOutputFormat(task.settings.target);
  const { input, settings } = task;
  const groupId = randomUUID();
  const base = baseName(input.filename);
  const downloads: ResultDownload[] = [];

  let renderedPages = 0;
  let totalPages = 0;
  let totalOutputSize = 0;
  let previewBefore: string | undefined;
  let previewAfter: string | undefined;
  let firstOutputWidth = 0;
  let firstOutputHeight = 0;
  let firstPageWidth = 0;
  let firstPageHeight = 0;

  try {
    const pdfBuffer = await fs.readFile(input.path);

    for await (const page of renderPdfPages(pdfBuffer, {
      maxPages: config.maxPdfPages,
      dpi: config.pdfRenderDpi,
      maxEdge: config.pdfMaxEdge,
    })) {
      renderedPages += 1;
      totalPages = page.totalPages;

      const pageSource = toImageSource(page);
      if (renderedPages === 1) {
        previewBefore = await createImagePreview(pageSource);
      }

      const encoded = await encodeImage(
        pageSource,
        target,
        settings.compression,
        settings.resize,
      );

      const stored = await saveOutput(job, {
        groupId,
        downloadName: `${base}-page-${String(page.pageNumber).padStart(3, '0')}.${target}`,
        data: encoded.data,
        mime: mimeForFormat(target),
        page: page.pageNumber,
      });

      totalOutputSize += stored.size;
      downloads.push({
        name: stored.downloadName,
        url: fileDownloadUrl(job.id, stored.id),
        size: stored.size,
        page: page.pageNumber,
      });

      if (renderedPages === 1) {
        previewAfter = await createBufferPreview(encoded.data);
        firstOutputWidth = encoded.width;
        firstOutputHeight = encoded.height;
        firstPageWidth = page.width;
        firstPageHeight = page.height;
      }
    }

    if (renderedPages === 0) {
      throw new ApiError(422, 'PDF_NO_PAGES', 'This PDF has no pages to render.', {
        fileName: input.filename,
      });
    }

    const zipName = `${base}-${target}-pages.zip`;
    const singleDownload = downloads.length === 1 ? downloads[0] : null;

    return {
      id: groupId,
      kind: 'pdf',
      fileName: singleDownload?.name ?? zipName,
      sources: [input.filename],
      inputFormat: input.format,
      outputFormat: target,
      compression: settings.compression,
      originalSize: input.size,
      outputSize: totalOutputSize,
      savedPercent: calculateSavedPercent(input.size, totalOutputSize),
      width: firstOutputWidth,
      height: firstOutputHeight,
      originalWidth: firstPageWidth,
      originalHeight: firstPageHeight,
      resolutionPreserved: isResolutionPreserved(
        firstPageWidth,
        firstPageHeight,
        firstOutputWidth,
        firstOutputHeight,
        Boolean(settings.resize),
      ),
      pages: renderedPages,
      durationMs: elapsedMs(startedAt),
      ...(previewBefore ? { previewBefore } : {}),
      ...(previewAfter ? { previewAfter } : {}),
      downloadUrl: singleDownload?.url ?? groupDownloadUrl(job.id, groupId, zipName),
      downloads,
      ...(totalPages > renderedPages
        ? { note: `Rendered the first ${renderedPages} of ${totalPages} pages.` }
        : {}),
    };
  } catch (error) {
    await deleteGroupFiles(job.id, groupId);
    throw error;
  }
}
