import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { convertRoutes } from './routes/convert.js';
import { downloadRoutes } from './routes/download.js';
import { healthRoutes } from './routes/health.js';
import { initJobStore, sweepStaleJobs } from './jobs/jobStore.js';
import { startCleanupCron, stopCleanupCron } from './jobs/cleanup.js';

const app = Fastify({
  logger: config.isProduction
    ? { level: 'info' }
    : {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      },
  bodyLimit: 2 * 1024 * 1024,
});

await initJobStore();
await sweepStaleJobs(config.cleanupMaxAgeMs);
startCleanupCron();

await app.register(multipart, {
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFiles,
    fields: 5,
    fieldSize: 1024 * 1024,
    parts: 50,
  },
});

registerErrorHandler(app);

await app.register(healthRoutes);
await app.register(convertRoutes);
await app.register(downloadRoutes);

const hasClientBuild = existsSync(path.join(config.clientDist, 'index.html'));

if (hasClientBuild) {
  await app.register(fastifyStatic, {
    root: config.clientDist,
    prefix: '/',
    index: ['index.html'],
  });
}

app.setNotFoundHandler((request, reply) => {
  const isApiRoute = request.url === '/api' || request.url.startsWith('/api/');

  if (request.method === 'GET' && !isApiRoute && hasClientBuild) {
    return reply.sendFile('index.html');
  }

  return reply.code(404).send({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found.`,
    },
  });
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`Received ${signal}, shutting down...`);
  stopCleanupCron();
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
    `Change IT ready on http://localhost:${config.port} (concurrency ${config.maxConcurrent}, temp ${config.tempRoot})`,
  );
  if (!hasClientBuild) {
    app.log.info('Client build not found. Run "npm run dev:client" or build the client for production.');
  }
} catch (error) {
  app.log.error({ err: error }, 'Failed to start server');
  stopCleanupCron();
  process.exit(1);
}
