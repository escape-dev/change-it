import type { FastifyBaseLogger } from 'fastify';
import { conversionLimit } from '../jobs/queue.js';
import type { Job } from '../jobs/jobStore.js';
import type {
  ConversionResult,
  ConvertResponse,
  ErrorDetail,
  IndexedError,
} from '../types/api.js';
import { ApiError, isUnsupportedError, stripErrorIndexes, toErrorDetail } from '../utils/errors.js';
import {
  detectInputs,
  planConversions,
  type ConversionTask,
} from './conversionPlan.js';
import { convertImageTask } from './converters/imageToImage.js';
import { convertImagesToPdf } from './converters/imagesToPdf.js';
import { convertPdfTask } from './converters/pdfToImages.js';
import type { ConvertOptions } from './options.js';
import type { UploadedFile } from './uploadService.js';

export interface ConvertUploadsInput {
  job: Job;
  options: ConvertOptions;
  uploads: UploadedFile[];
  logger: FastifyBaseLogger;
}

interface TaskTracker {
  results: Map<number, ConversionResult>;
  errors: IndexedError[];
  logger: FastifyBaseLogger;
}

function logCompletedConversion(logger: FastifyBaseLogger, result: ConversionResult): void {
  logger.info(
    {
      fileName: result.sources[0],
      kind: result.kind,
      outputFormat: result.outputFormat,
      compression: result.compression,
      pages: result.pages,
      durationMs: result.durationMs,
      originalSize: result.originalSize,
      outputSize: result.outputSize,
    },
    'conversion completed',
  );
}

async function runTask(
  tracker: TaskTracker,
  task: ConversionTask,
  convert: () => Promise<ConversionResult>,
): Promise<void> {
  try {
    const result = await conversionLimit(convert);
    tracker.results.set(task.input.index, result);
    logCompletedConversion(tracker.logger, result);
  } catch (error) {
    tracker.logger.warn(
      { err: error, fileName: task.input.filename },
      'conversion failed',
    );
    tracker.errors.push({
      index: task.input.index,
      ...toErrorDetail(error, task.input.filename),
    });
  }
}

async function runPdfGroupTask(
  tracker: TaskTracker,
  tasks: ConversionTask[],
  job: Job,
  pageFit: ConvertOptions['pageFit'],
): Promise<void> {
  const groupIndex = tasks[0]?.input.index ?? 0;

  try {
    const outcome = await conversionLimit(() => convertImagesToPdf(tasks, job, pageFit));

    for (const failure of outcome.failures) {
      tracker.logger.warn(
        { fileName: failure.fileName, code: failure.code },
        'file could not be added to PDF',
      );
      tracker.errors.push(failure);
    }

    if (outcome.result) {
      tracker.results.set(groupIndex, outcome.result);
      logCompletedConversion(tracker.logger, outcome.result);
    }
  } catch (error) {
    tracker.logger.warn({ err: error }, 'PDF assembly failed');
    tracker.errors.push({ index: groupIndex, ...toErrorDetail(error) });
  }
}

function sortResults(results: Map<number, ConversionResult>): ConversionResult[] {
  return [...results.entries()].sort(([a], [b]) => a - b).map(([, result]) => result);
}

function sortErrors(errors: IndexedError[]): ErrorDetail[] {
  const sorted = [...errors].sort((a, b) => a.index - b.index);
  return stripErrorIndexes(sorted);
}

function assertSomeResults(
  results: Map<number, ConversionResult>,
  errors: ErrorDetail[],
): void {
  if (results.size > 0) return;

  const allUnsupported = errors.every(isUnsupportedError);
  const singleError = errors.length === 1 ? errors[0] : null;

  throw new ApiError(
    allUnsupported ? 415 : 422,
    allUnsupported ? 'UNSUPPORTED_TYPE' : 'ALL_FILES_FAILED',
    singleError?.message ??
      'None of the files could be processed. Check the file formats and try again.',
    { details: errors },
  );
}

export async function convertUploads({
  job,
  options,
  uploads,
  logger,
}: ConvertUploadsInput): Promise<ConvertResponse> {
  const errors: IndexedError[] = [];
  const results = new Map<number, ConversionResult>();
  const tracker: TaskTracker = { results, errors, logger };

  const inputs = await detectInputs(uploads, errors);
  if (inputs.length === 0) {
    throw new ApiError(
      415,
      'UNSUPPORTED_TYPE',
      'None of the selected files are supported. Use JPG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, GIF, or PDF.',
      { details: stripErrorIndexes(errors) },
    );
  }

  const plan = planConversions(inputs, options, errors);

  await Promise.all(
    plan.imageTasks.map((task) => runTask(tracker, task, () => convertImageTask(task, job))),
  );

  await Promise.all(
    plan.pdfInputTasks.map((task) => runTask(tracker, task, () => convertPdfTask(task, job))),
  );

  if (plan.pdfGroupTasks.length > 0) {
    await runPdfGroupTask(tracker, plan.pdfGroupTasks, job, options.pageFit);
  }

  const responseErrors = sortErrors(errors);
  assertSomeResults(results, responseErrors);

  return {
    jobId: job.id,
    results: sortResults(results),
    errors: responseErrors,
  };
}
