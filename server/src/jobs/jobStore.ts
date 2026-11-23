import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { config } from '../config.js';

export interface StoredFile {
  id: string;
  jobId: string;
  groupId?: string;
  path: string;
  downloadName: string;
  mime: string;
  size: number;
  page?: number;
}

export interface Job {
  id: string;
  dir: string;
  inputDir: string;
  outputDir: string;
  createdAt: number;
  lastActivity: number;
  files: Map<string, StoredFile>;
  timer?: NodeJS.Timeout;
}

export interface SaveOutputInput {
  groupId?: string;
  downloadName: string;
  data: Buffer;
  mime: string;
  page?: number;
}

const jobs = new Map<string, Job>();

async function safeRemove(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
}

function touchJob(job: Job): void {
  if (job.timer) clearTimeout(job.timer);

  job.lastActivity = Date.now();
  job.timer = setTimeout(() => {
    void removeJob(job.id);
  }, config.jobTtlMs);
  job.timer.unref();
}

export async function initJobStore(): Promise<void> {
  await fs.mkdir(config.tempRoot, { recursive: true });
}

export async function createJob(): Promise<Job> {
  const id = randomUUID();
  const dir = path.join(config.tempRoot, id);
  const inputDir = path.join(dir, 'in');
  const outputDir = path.join(dir, 'out');

  await fs.mkdir(inputDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const job: Job = {
    id,
    dir,
    inputDir,
    outputDir,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    files: new Map(),
  };

  jobs.set(id, job);
  touchJob(job);
  return job;
}

export function getStoredFile(jobId: string, fileId: string): StoredFile | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;

  touchJob(job);
  return job.files.get(fileId);
}

export function getGroupFiles(jobId: string, groupId: string): StoredFile[] {
  const job = jobs.get(jobId);
  if (!job) return [];

  touchJob(job);
  return [...job.files.values()].filter((file) => file.groupId === groupId);
}

export function getAllFiles(jobId: string): StoredFile[] {
  const job = jobs.get(jobId);
  if (!job) return [];

  touchJob(job);
  return [...job.files.values()];
}

export async function saveOutput(job: Job, output: SaveOutputInput): Promise<StoredFile> {
  const id = randomUUID();
  const filePath = path.join(job.outputDir, id);
  await fs.writeFile(filePath, output.data);

  const record: StoredFile = {
    id,
    jobId: job.id,
    ...(output.groupId ? { groupId: output.groupId } : {}),
    path: filePath,
    downloadName: output.downloadName,
    mime: output.mime,
    size: output.data.byteLength,
    ...(output.page !== undefined ? { page: output.page } : {}),
  };

  job.files.set(id, record);
  touchJob(job);
  return record;
}

export async function deleteGroupFiles(jobId: string, groupId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const groupFiles = [...job.files.values()].filter((file) => file.groupId === groupId);
  for (const file of groupFiles) {
    job.files.delete(file.id);
  }

  await Promise.all(groupFiles.map((file) => safeRemove(file.path)));
}

export async function removeJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);

  if (job?.timer) clearTimeout(job.timer);
  jobs.delete(jobId);

  await safeRemove(job?.dir ?? path.join(config.tempRoot, jobId));
}

export async function removeJobInputs(job: Job): Promise<void> {
  await safeRemove(job.inputDir);
}

async function sweepRegisteredJobs(maxAgeMs: number, now: number): Promise<number> {
  let removed = 0;

  for (const job of [...jobs.values()]) {
    if (now - job.lastActivity > maxAgeMs) {
      await removeJob(job.id);
      removed += 1;
    }
  }

  return removed;
}

async function readTempDirectories(): Promise<Dirent[] | null> {
  try {
    return await fs.readdir(config.tempRoot, { withFileTypes: true });
  } catch {
    return null;
  }
}

async function sweepOrphanDirectories(maxAgeMs: number, now: number): Promise<number> {
  const entries = await readTempDirectories();
  if (!entries) return 0;

  let removed = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || jobs.has(entry.name)) continue;

    const dirPath = path.join(config.tempRoot, entry.name);

    try {
      const stats = await fs.stat(dirPath);
      if (now - stats.mtimeMs <= maxAgeMs) continue;

      await safeRemove(dirPath);
      removed += 1;
    } catch {
      continue;
    }
  }

  return removed;
}

export async function sweepStaleJobs(maxAgeMs: number): Promise<number> {
  const now = Date.now();
  const registeredRemoved = await sweepRegisteredJobs(maxAgeMs, now);
  const orphanRemoved = await sweepOrphanDirectories(maxAgeMs, now);
  return registeredRemoved + orphanRemoved;
}

export function activeJobCount(): number {
  return jobs.size;
}
