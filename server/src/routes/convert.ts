import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { fileTypeFromFile } from 'file-type';
import { config } from '../config.js';
import { conversionLimit } from '../jobs/queue.js';
import {
  createJob,
  deleteGroupFiles,
  removeJob,
  saveOutput,
  type Job,
} from '../jobs/jobStore.js';
import {
  createBufferPreview,
  createImagePreview,
  encodeForPdf,
  encodeImage,
  prepareImageSource,
  type ImageSource,
} from '../services/imageProcessor.js';
import {
  buildPdfFromImages,
  renderPdfPages,
  type PdfImageInput,
} from '../services/pdfProcessor.js';
import { parseOptions, type ConvertOptions } from '../services/options.js';
import { ApiError, toErrorDetail, type ErrorDetail } from '../utils/errors.js';
import {
  extForFormat,
  isPdfFormat,
  mimeForFormat,
  normalizeInputFormat,
  type CompressionLevel,
  type ImageOutputFormat,
  type InputFormat,
  type OutputFormat,
} from '../utils/formats.js';
import { baseName } from '../utils/files.js';

interface UploadedFile {
  index: number;
  path: string;
  filename: string;
  size: number;
}

interface DetectedInput extends UploadedFile {
  format: InputFormat;
}

interface ResolvedSettings {
  target: OutputFormat;
  compression: CompressionLevel;
  resize: ConvertOptions['resize'];
}

interface ConversionTask {
  input: DetectedInput;
  settings: ResolvedSettings;
}

interface IndexedError extends ErrorDetail {
  index: number;
}

interface ResultDownload {
  name: string;
  url: string;
  size: number;
  page?: number;
}

interface ConversionResult {
  id: string;
  kind: 'image' | 'pdf';
  fileName: string;
  sources: string[];
  inputFormat: string;
  outputFormat: string;
  compression: string;
  originalSize: number;
  outputSize: number;
  savedPercent: number;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
  resolutionPreserved?: boolean;
  pages?: number;
  durationMs: number;
  previewBefore?: string;
  previewAfter?: string;
  downloadUrl: string;
  downloads?: ResultDownload[];
  note?: string;
}

interface ConvertResponse {
  jobId: string;
  results: ConversionResult[];
  errors: ErrorDetail[];
}

function fileUrl(jobId: string, fileId: string): string {
  return `/api/download/${jobId}/file/${fileId}`;
}

function groupUrl(jobId: string, groupId: string, name?: string): string {
  const base = `/api/download/${jobId}/group/${groupId}`;
  return name ? `${base}?name=${encodeURIComponent(name)}` : base;
}

function savedPercent(originalSize: number, outputSize: number): number {
  if (originalSize <= 0) return 0;
  return Math.round((1 - outputSize / originalSize) * 100);
}

function resolveSettings(index: number, options: ConvertOptions): ResolvedSettings {
  const override = options.perFile[index] ?? null;
  return {
    target: override?.targetFormat ?? options.targetFormat,
    compression: override?.compression ?? options.compression,
    resize: override?.resize !== undefined ? override.resize : options.resize,
  };
}

async function readMultipart(
  request: FastifyRequest,
  job: Job,
): Promise<{ options: ConvertOptions; uploads: UploadedFile[] }> {
  let rawOptions: unknown = undefined;
  let optionSeen = false;
  const uploads: UploadedFile[] = [];

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (part.fieldname !== 'files' && part.fieldname !== 'file') {
        part.file.resume();
        continue;
      }

      if (uploads.length >= config.maxFiles) {
        part.file.resume();
        throw new ApiError(
          400,
          'TOO_MANY_FILES',
          `You can upload up to ${config.maxFiles} files in a single batch.`,
          { fileName: part.filename ?? undefined },
        );
      }

      const index = uploads.length;
      const destination = `${index}-${randomUUID()}`;
      const destinationPath = `${job.inputDir}/${destination}`;

      try {
        await pipeline(part.file, createWriteStream(destinationPath));
      } catch (error) {
        const tooLarge =
          part.file.truncated ||
          (error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE' ||
          (error as { name?: string }).name === 'RequestFileTooLargeError';

        if (tooLarge) {
          throw new ApiError(
            413,
            'FILE_TOO_LARGE',
            `"${part.filename ?? 'This file'}" is larger than 50 MB.`,
            { fileName: part.filename ?? undefined },
          );
        }

        throw new ApiError(400, 'UPLOAD_FAILED', 'The upload could not be saved. Please try again.', {
          fileName: part.filename ?? undefined,
          cause: error,
        });
      }

      if (part.file.truncated) {
        throw new ApiError(
          413,
          'FILE_TOO_LARGE',
          `"${part.filename ?? 'This file'}" is larger than 50 MB.`,
          { fileName: part.filename ?? undefined },
        );
      }

      const stat = await fs.stat(destinationPath);
      uploads.push({
        index,
        path: destinationPath,
        filename: part.filename ?? `upload-${index + 1}`,
        size: stat.size,
      });
      continue;
    }

    if (part.fieldname === 'options') {
      optionSeen = true;
      const value = part.value;
      if (typeof value === 'string') {
        try {
          rawOptions = value.trim().length > 0 ? JSON.parse(value) : undefined;
        } catch {
          throw new ApiError(400, 'INVALID_OPTIONS', 'The options field must contain valid JSON.');
        }
      }
    }
  }

  if (uploads.length === 0) {
    throw new ApiError(400, 'NO_FILES', 'Drop at least one file to convert.');
  }

  const options = parseOptions(optionSeen ? rawOptions : undefined);
  return { options, uploads };
}

async function detectInputs(
  uploads: UploadedFile[],
  errors: IndexedError[],
): Promise<DetectedInput[]> {
  const detected: DetectedInput[] = [];

  for (const upload of uploads) {
    let ext: string | undefined;
    try {
      const result = await fileTypeFromFile(upload.path);
      ext = result?.ext;
    } catch {
      ext = undefined;
    }

    const format = ext ? normalizeInputFormat(ext) : null;
    if (!format) {
      errors.push({
        index: upload.index,
        code: 'UNSUPPORTED_TYPE',
        message:
          'This file type is not supported. Use JPG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, GIF, or PDF.',
        fileName: upload.filename,
      });
      continue;
    }

    detected.push({ ...upload, format });
  }

  return detected;
}

export async function convertRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/convert', async (request, reply) => {
    const job = await createJob();

    try {
      const { options, uploads } = await readMultipart(request, job);
      const errors: IndexedError[] = [];
      const inputs = await detectInputs(uploads, errors);

      if (inputs.length === 0) {
        throw new ApiError(
          415,
          'UNSUPPORTED_TYPE',
          'None of the selected files are supported. Use JPG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, GIF, or PDF.',
          { details: errors.map(({ index: _index, ...detail }) => detail) },
        );
      }

      const imageTasks: ConversionTask[] = [];
      const pdfInputTasks: ConversionTask[] = [];
      const pdfGroupTasks: ConversionTask[] = [];

      for (const input of inputs) {
        const settings = resolveSettings(input.index, options);

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
            pdfInputTasks.push({ input, settings });
          }
          continue;
        }

        if (settings.target === 'pdf') {
          pdfGroupTasks.push({ input, settings });
        } else {
          imageTasks.push({ input, settings });
        }
      }

      const resultsByIndex = new Map<number, ConversionResult>();

      await Promise.all(
        imageTasks.map((task) =>
          conversionLimit(async () => {
            const started = performance.now();
            const target = task.settings.target as ImageOutputFormat;
            try {
              const source = await prepareImageSource(task.input.path, task.input.format, task.input.filename);
              const previewBefore = await createImagePreview(source);
              const encoded = await encodeImage(
                source,
                target,
                task.settings.compression,
                task.settings.resize,
              );
              const previewAfter = await createBufferPreview(encoded.data);
              const downloadName = `${baseName(task.input.filename)}.${extForFormat(target)}`;
              const stored = await saveOutput(job, {
                downloadName,
                data: encoded.data,
                mime: mimeForFormat(target),
              });

              const durationMs = Math.round(performance.now() - started);
              resultsByIndex.set(task.input.index, {
                id: stored.id,
                kind: 'image',
                fileName: stored.downloadName,
                sources: [task.input.filename],
                inputFormat: task.input.format,
                outputFormat: target,
                compression: task.settings.compression,
                originalSize: task.input.size,
                outputSize: stored.size,
                savedPercent: savedPercent(task.input.size, stored.size),
                width: encoded.width,
                height: encoded.height,
                originalWidth: source.width,
                originalHeight: source.height,
                resolutionPreserved:
                  !task.settings.resize &&
                  encoded.width === source.width &&
                  encoded.height === source.height,
                durationMs,
                ...(previewBefore ? { previewBefore } : {}),
                ...(previewAfter ? { previewAfter } : {}),
                downloadUrl: fileUrl(job.id, stored.id),
              });

              request.log.info(
                {
                  fileName: task.input.filename,
                  target,
                  compression: task.settings.compression,
                  durationMs,
                  originalSize: task.input.size,
                  outputSize: stored.size,
                  width: encoded.width,
                  height: encoded.height,
                },
                'converted image',
              );
            } catch (error) {
              request.log.warn({ err: error }, `Failed to convert ${task.input.filename}`);
              errors.push({ index: task.input.index, ...toErrorDetail(error, task.input.filename) });
            }
          }),
        ),
      );

      await Promise.all(
        pdfInputTasks.map((task) =>
          conversionLimit(async () => {
            const started = performance.now();
            const target = task.settings.target as ImageOutputFormat;
            const groupId = randomUUID();
            const downloads: ResultDownload[] = [];
            let totalRendered = 0;
            let totalPages = 0;
            let totalOutputSize = 0;
            let previewBefore: string | undefined;
            let previewAfter: string | undefined;
            let firstWidth = 0;
            let firstHeight = 0;
            let firstOriginalWidth = 0;
            let firstOriginalHeight = 0;

            try {
              const pdfBuffer = await fs.readFile(task.input.path);

              for await (const page of renderPdfPages(pdfBuffer, {
                maxPages: config.maxPdfPages,
                dpi: config.pdfRenderDpi,
                maxEdge: config.pdfMaxEdge,
              })) {
                totalRendered += 1;
                totalPages = page.totalPages;

                const pageSource: ImageSource = {
                  buffer: page.png,
                  format: 'png',
                  width: page.width,
                  height: page.height,
                  hasAlpha: false,
                };

                if (totalRendered === 1) {
                  previewBefore = await createImagePreview(pageSource);
                }

                const encoded = await encodeImage(
                  pageSource,
                  target,
                  task.settings.compression,
                  task.settings.resize,
                );

                const base = baseName(task.input.filename);
                const downloadName = `${base}-page-${String(page.pageNumber).padStart(3, '0')}.${extForFormat(target)}`;
                const stored = await saveOutput(job, {
                  groupId,
                  downloadName,
                  data: encoded.data,
                  mime: mimeForFormat(target),
                  page: page.pageNumber,
                });

                totalOutputSize += stored.size;
                downloads.push({
                  name: stored.downloadName,
                  url: fileUrl(job.id, stored.id),
                  size: stored.size,
                  page: page.pageNumber,
                });

                if (totalRendered === 1) {
                  previewAfter = await createBufferPreview(encoded.data);
                  firstWidth = encoded.width;
                  firstHeight = encoded.height;
                  firstOriginalWidth = page.width;
                  firstOriginalHeight = page.height;
                }
              }

              if (totalRendered === 0) {
                throw new ApiError(422, 'PDF_NO_PAGES', 'This PDF has no pages to render.', {
                  fileName: task.input.filename,
                });
              }

              const base = baseName(task.input.filename);
              const downloadUrl =
                downloads.length === 1 && downloads[0]
                  ? downloads[0].url
                  : groupUrl(job.id, groupId, `${base}-${target}-pages.zip`);

              resultsByIndex.set(task.input.index, {
                id: groupId,
                kind: 'pdf',
                fileName:
                  downloads.length === 1 && downloads[0]
                    ? downloads[0].name
                    : `${base}-${target}-pages.zip`,
                sources: [task.input.filename],
                inputFormat: task.input.format,
                outputFormat: target,
                compression: task.settings.compression,
                originalSize: task.input.size,
                outputSize: totalOutputSize,
                savedPercent: savedPercent(task.input.size, totalOutputSize),
                width: firstWidth,
                height: firstHeight,
                originalWidth: firstOriginalWidth,
                originalHeight: firstOriginalHeight,
                resolutionPreserved:
                  !task.settings.resize &&
                  firstWidth === firstOriginalWidth &&
                  firstHeight === firstOriginalHeight,
                pages: totalRendered,
                durationMs: Math.round(performance.now() - started),
                ...(previewBefore ? { previewBefore } : {}),
                ...(previewAfter ? { previewAfter } : {}),
                downloadUrl,
                downloads,
                ...(totalPages > totalRendered
                  ? { note: `Rendered the first ${totalRendered} of ${totalPages} pages.` }
                  : {}),
              });

              request.log.info(
                {
                  fileName: task.input.filename,
                  target,
                  compression: task.settings.compression,
                  pages: totalRendered,
                  durationMs: Math.round(performance.now() - started),
                  originalSize: task.input.size,
                  outputSize: totalOutputSize,
                },
                'rendered PDF pages',
              );
            } catch (error) {
              await deleteGroupFiles(job.id, groupId);
              request.log.warn({ err: error }, `Failed to render PDF ${task.input.filename}`);
              errors.push({ index: task.input.index, ...toErrorDetail(error, task.input.filename) });
            }
          }),
        ),
      );

      if (pdfGroupTasks.length > 0) {
        const firstIndex = Math.min(...pdfGroupTasks.map((task) => task.input.index));

        await conversionLimit(async () => {
          const started = performance.now();
          const pdfImages: PdfImageInput[] = [];
          const sources: string[] = [];
          let originalSize = 0;
          let previewBefore: string | undefined;
          let firstFormat = pdfGroupTasks[0]?.input.format ?? 'jpg';
          let compressionLabel: CompressionLevel | null = null;
          let mixedCompression = false;

          for (const task of pdfGroupTasks) {
            try {
              const source = await prepareImageSource(task.input.path, task.input.format, task.input.filename);
              if (!previewBefore) previewBefore = await createImagePreview(source);
              const encoded = await encodeForPdf(
                source,
                task.settings.compression,
                task.settings.resize,
              );
              pdfImages.push(encoded);
              sources.push(task.input.filename);
              originalSize += task.input.size;
              firstFormat = task.input.format;

              if (compressionLabel === null) compressionLabel = task.settings.compression;
              else if (compressionLabel !== task.settings.compression) mixedCompression = true;
            } catch (error) {
              request.log.warn({ err: error }, `Failed to prepare ${task.input.filename} for PDF`);
              errors.push({ index: task.input.index, ...toErrorDetail(error, task.input.filename) });
            }
          }

          if (pdfImages.length === 0) return;

          try {
            const pdfBytes = await buildPdfFromImages(pdfImages, options.pageFit);
            const downloadName = `change-it-${Date.now()}.pdf`;
            const stored = await saveOutput(job, {
              downloadName,
              data: pdfBytes,
              mime: 'application/pdf',
            });

            resultsByIndex.set(firstIndex, {
              id: stored.id,
              kind: 'pdf',
              fileName: stored.downloadName,
              sources,
              inputFormat: sources.length > 1 ? 'images' : firstFormat,
              outputFormat: 'pdf',
              compression: mixedCompression ? 'mixed' : (compressionLabel ?? options.compression),
              originalSize,
              outputSize: stored.size,
              savedPercent: savedPercent(originalSize, stored.size),
              pages: pdfImages.length,
              durationMs: Math.round(performance.now() - started),
              ...(previewBefore ? { previewBefore } : {}),
              downloadUrl: fileUrl(job.id, stored.id),
            });

            request.log.info(
              {
                pages: pdfImages.length,
                durationMs: Math.round(performance.now() - started),
                originalSize,
                outputSize: stored.size,
              },
              'built PDF from images',
            );
          } catch (error) {
            request.log.warn({ err: error }, 'Failed to build PDF from images');
            errors.push({ index: firstIndex, ...toErrorDetail(error) });
          }
        });
      }

      const results = [...resultsByIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, result]) => result);

      const sortedErrors: ErrorDetail[] = errors
        .sort((a, b) => a.index - b.index)
        .map(({ index: _index, ...detail }) => detail);

      if (results.length === 0) {
        const allUnsupported = sortedErrors.every(
          (error) => error.code === 'UNSUPPORTED_TYPE' || error.code === 'PDF_TO_PDF_UNSUPPORTED',
        );
        throw new ApiError(
          allUnsupported ? 415 : 422,
          allUnsupported ? 'UNSUPPORTED_TYPE' : 'ALL_FILES_FAILED',
          sortedErrors.length === 1 && sortedErrors[0]
            ? sortedErrors[0].message
            : 'None of the files could be processed. Check the file formats and try again.',
          { details: sortedErrors },
        );
      }

      const response: ConvertResponse = {
        jobId: job.id,
        results,
        errors: sortedErrors,
      };

      return reply.send(response);
    } catch (error) {
      await removeJob(job.id);
      throw error;
    } finally {
      await fs.rm(job.inputDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}
