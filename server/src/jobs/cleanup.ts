import cron from 'node-cron';
import { config } from '../config.js';
import { sweepStaleJobs } from './jobStore.js';

let task: ReturnType<typeof cron.schedule> | null = null;

export function startCleanupCron(): void {
  if (task) return;
  task = cron.schedule(config.cleanupCron, () => {
    void sweepStaleJobs(config.cleanupMaxAgeMs)
      .then((removed) => {
        if (removed > 0) {
          console.log(`[change-it] cleanup removed ${removed} expired workspace(s)`);
        }
      })
      .catch((error: unknown) => {
        console.error('[change-it] cleanup sweep failed', error);
      });
  });
}

export function stopCleanupCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
