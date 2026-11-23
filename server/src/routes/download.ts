import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import {
  getAllFiles,
  getGroupFiles,
  getStoredFile,
  removeJob,
} from '../jobs/jobStore.js';
import { createZipStream } from '../services/zipService.js';
import { ApiError } from '../utils/errors.js';
import { contentDisposition, sanitizeFilename } from '../utils/files.js';

const EXPIRED_MESSAGE = 'These files have expired. Please convert them again.';

async function ensureExists(filePath: string): Promise<void> {
  try {
    await fsPromises.access(filePath, fs.constants.R_OK);
  } catch {
    throw new ApiError(404, 'FILE_NOT_FOUND', EXPIRED_MESSAGE);
  }
}

export async function downloadRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/download/:jobId/all', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const files = getAllFiles(jobId);

    if (files.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', EXPIRED_MESSAGE);
    }

    for (const file of files) {
      await ensureExists(file.path);
    }

    const archive = createZipStream(files);
    archive.on('error', (error) => {
      request.log.error({ err: error }, 'ZIP stream failed');
      reply.raw.destroy(error);
    });

    const fileName = `change-it-${jobId.slice(0, 8)}.zip`;
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', contentDisposition(fileName));
    reply.header('Cache-Control', 'no-store');

    reply.raw.on('close', () => {
      void removeJob(jobId);
    });

    return reply.send(archive);
  });

  app.get('/api/download/:jobId/group/:groupId', async (request, reply) => {
    const { jobId, groupId } = request.params as { jobId: string; groupId: string };
    const files = getGroupFiles(jobId, groupId);

    if (files.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', EXPIRED_MESSAGE);
    }

    for (const file of files) {
      await ensureExists(file.path);
    }

    const archive = createZipStream(files);
    archive.on('error', (error) => {
      request.log.error({ err: error }, 'ZIP stream failed');
      reply.raw.destroy(error);
    });

    const query = request.query as { name?: string };
    const requested = typeof query.name === 'string' ? sanitizeFilename(query.name) : '';
    const fileName = requested.toLowerCase().endsWith('.zip')
      ? requested
      : `change-it-${groupId.slice(0, 8)}.zip`;

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', contentDisposition(fileName));
    reply.header('Cache-Control', 'no-store');

    return reply.send(archive);
  });

  app.get('/api/download/:jobId/file/:fileId', async (request, reply) => {
    const { jobId, fileId } = request.params as { jobId: string; fileId: string };
    const file = getStoredFile(jobId, fileId);

    if (!file) {
      throw new ApiError(404, 'NOT_FOUND', EXPIRED_MESSAGE);
    }

    await ensureExists(file.path);

    reply.header('Content-Type', file.mime);
    reply.header('Content-Length', String(file.size));
    reply.header('Content-Disposition', contentDisposition(file.downloadName));
    reply.header('Cache-Control', 'no-store');

    return reply.send(fs.createReadStream(file.path));
  });
}
