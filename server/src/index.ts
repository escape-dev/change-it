import './env.js';
import { buildApp, clientBuildExists } from './app.js';
import { config } from './config.js';
import { startCleanupCron, stopCleanupCron } from './jobs/cleanup.js';
import { sweepStaleJobs } from './jobs/jobStore.js';

const app = await buildApp();

await sweepStaleJobs(config.cleanupMaxAgeMs);
startCleanupCron(app.log);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  app.log.info({ signal }, 'shutting down');
  await stopCleanupCron();

  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    {
      port: config.port,
      concurrency: config.maxConcurrent,
      tempRoot: config.tempRoot,
    },
    'Change IT is ready',
  );

  if (!clientBuildExists()) {
    app.log.info('Client build not found. Run "npm run dev:client" or build the client for production.');
  }
} catch (error) {
  app.log.error({ err: error }, 'failed to start server');
  await stopCleanupCron();
  process.exit(1);
}
