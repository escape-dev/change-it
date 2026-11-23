import { performance } from 'node:perf_hooks';

export function fileDownloadUrl(jobId: string, fileId: string): string {
  return `/api/download/${jobId}/file/${fileId}`;
}

export function groupDownloadUrl(jobId: string, groupId: string, zipName?: string): string {
  const base = `/api/download/${jobId}/group/${groupId}`;
  return zipName ? `${base}?name=${encodeURIComponent(zipName)}` : base;
}

export function calculateSavedPercent(originalSize: number, outputSize: number): number {
  if (originalSize <= 0) return 0;
  return Math.round((1 - outputSize / originalSize) * 100);
}

export function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

export function isResolutionPreserved(
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  resized: boolean,
): boolean {
  return !resized && sourceWidth === outputWidth && sourceHeight === outputHeight;
}
