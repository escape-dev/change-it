import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  getAllFiles,
  getGroupFiles,
  getStoredFile,
  removeJob,
  type StoredFile,
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

async function ensureAllExist(files: StoredFile[]): Promise<void> {
  await Promise.all(files.map((file) => ensureExists(file.path)));
}

function sendZip(
  request: FastifyRequest,
  reply: FastifyReply,
  files: StoredFile[],
  fileName: string,
  onClose?: () => void,
): FastifyReply {
  const archive = createZipStream(files);

  archive.on('error', (error) => {
    request.log.error({ err: error }, 'ZIP stream failed');
    reply.raw.destroy(error);
  });

  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', contentDisposition(fileName));
  reply.header('Cache-Control', 'no-store');

  if (onClose) {
    reply.raw.on('close', onClose);
  }

  return reply.send(archive);
}

export async function downloadRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { jobId: string } }>('/api/download/:jobId/all', async (request, reply) => {
    const { jobId } = request.params;
    const files = getAllFiles(jobId);

    if (files.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', EXPIRED_MESSAGE);
    }

    await ensureAllExist(files);

    return sendZip(request, reply, files, `change-it-${jobId.slice(0, 8)}.zip`, () => {
      void removeJob(jobId);
    });
  });

  app.get<{
    Params: { jobId: string; groupId: string };
    Querystring: { name?: string };
  }>('/api/download/:jobId/group/:groupId', async (request, reply) => {
    const { jobId, groupId } = request.params;
    const files = getGroupFiles(jobId, groupId);

    if (files.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', EXPIRED_MESSAGE);
    }

    await ensureAllExist(files);

    const requestedName = request.query.name ? sanitizeFilename(request.query.name) : '';
    const fileName = requestedName.toLowerCase().endsWith('.zip')
      ? requestedName
      : `change-it-${groupId.slice(0, 8)}.zip`;

    return sendZip(request, reply, files, fileName);
  });

  app.get<{ Params: { jobId: string; fileId: string } }>(
    '/api/download/:jobId/file/:fileId',
    async (request, reply) => {
      const { jobId, fileId } = request.params;
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
    },
  );
}
