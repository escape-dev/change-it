import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';
import { sweepStaleJobs } from './jobStore.js';

let task: ReturnType<typeof cron.schedule> | null = null;

async function runCleanup(logger: FastifyBaseLogger): Promise<void> {
  try {
    const removed = await sweepStaleJobs(config.cleanupMaxAgeMs);
    if (removed > 0) {
      logger.info({ removed }, 'cleanup removed expired workspaces');
    }
  } catch (error) {
    logger.error({ err: error }, 'cleanup sweep failed');
  }
}

export function startCleanupCron(logger: FastifyBaseLogger): void {
  if (task) return;

  task = cron.schedule(config.cleanupCron, () => {
    void runCleanup(logger);
  });
}

export async function stopCleanupCron(): Promise<void> {
  const currentTask = task;
  task = null;

  if (currentTask) {
    await currentTask.stop();
  }
}
