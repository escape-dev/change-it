import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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

const jobs = new Map<string, Job>();

export async function initJobStore(): Promise<void> {
  await fs.mkdir(config.tempRoot, { recursive: true });
}

function scheduleExpiry(job: Job): void {
  if (job.timer) clearTimeout(job.timer);
  job.lastActivity = Date.now();
  job.timer = setTimeout(() => {
    void removeJob(job.id);
  }, config.jobTtlMs);
  job.timer.unref();
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
  scheduleExpiry(job);
  return job;
}

export function getJob(jobId: string): Job | undefined {
  const job = jobs.get(jobId);
  if (job) scheduleExpiry(job);
  return job;
}

export function peekJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function getStoredFile(jobId: string, fileId: string): StoredFile | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  scheduleExpiry(job);
  return job.files.get(fileId);
}

export function getGroupFiles(jobId: string, groupId: string): StoredFile[] {
  const job = jobs.get(jobId);
  if (!job) return [];
  scheduleExpiry(job);
  return [...job.files.values()].filter((file) => file.groupId === groupId);
}

export function getAllFiles(jobId: string): StoredFile[] {
  const job = jobs.get(jobId);
  if (!job) return [];
  scheduleExpiry(job);
  return [...job.files.values()];
}

export async function saveOutput(
  job: Job,
  input: {
    groupId?: string;
    downloadName: string;
    data: Buffer;
    mime: string;
    page?: number;
  },
): Promise<StoredFile> {
  const id = randomUUID();
  const filePath = path.join(job.outputDir, id);
  await fs.writeFile(filePath, input.data);

  const record: StoredFile = {
    id,
    jobId: job.id,
    ...(input.groupId ? { groupId: input.groupId } : {}),
    path: filePath,
    downloadName: input.downloadName,
    mime: input.mime,
    size: input.data.byteLength,
    ...(input.page !== undefined ? { page: input.page } : {}),
  };

  job.files.set(id, record);
  scheduleExpiry(job);
  return record;
}

export async function deleteGroupFiles(jobId: string, groupId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  for (const [id, file] of job.files) {
    if (file.groupId === groupId) {
      job.files.delete(id);
      await fs.rm(file.path, { force: true });
    }
  }
}

export async function removeJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) {
    await fs.rm(path.join(config.tempRoot, jobId), { recursive: true, force: true });
    return;
  }

  if (job.timer) clearTimeout(job.timer);
  jobs.delete(jobId);
  await fs.rm(job.dir, { recursive: true, force: true });
}

export async function sweepStaleJobs(maxAgeMs: number): Promise<number> {
  let removed = 0;
  const now = Date.now();

  for (const job of [...jobs.values()]) {
    if (now - job.lastActivity > maxAgeMs) {
      await removeJob(job.id);
      removed += 1;
    }
  }

  let entries;
  try {
    entries = await fs.readdir(config.tempRoot, { withFileTypes: true });
  } catch {
    return removed;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || jobs.has(entry.name)) continue;
    const dirPath = path.join(config.tempRoot, entry.name);
    try {
      const stat = await fs.stat(dirPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.rm(dirPath, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      void 0;
    }
  }

  return removed;
}

export function activeJobCount(): number {
  return jobs.size;
}
