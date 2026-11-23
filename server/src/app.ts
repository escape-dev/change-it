import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { initJobStore } from './jobs/jobStore.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { convertRoutes } from './routes/convert.js';
import { downloadRoutes } from './routes/download.js';
import { healthRoutes } from './routes/health.js';

function loggerOptions(): FastifyServerOptions['logger'] {
  if (config.isProduction) {
    return { level: 'info' };
  }

  return {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  };
}

export function clientBuildExists(): boolean {
  return existsSync(path.join(config.clientDist, 'index.html'));
}

async function registerClientServing(app: FastifyInstance): Promise<void> {
  const hasClientBuild = clientBuildExists();

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
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(),
    bodyLimit: config.uploadBodyLimit,
  });

  await initJobStore();

  await app.register(multipart, {
    limits: {
      fileSize: config.maxFileSize,
      files: config.maxFiles,
      fields: config.maxUploadFields,
      fieldSize: config.uploadFieldSize,
      parts: config.maxUploadParts,
    },
  });

  registerErrorHandler(app);

  await app.register(healthRoutes);
  await app.register(convertRoutes);
  await app.register(downloadRoutes);

  await registerClientServing(app);

  return app;
}
