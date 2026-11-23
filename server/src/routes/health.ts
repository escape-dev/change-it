import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { activeJobCount } from '../jobs/jobStore.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'change-it',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    activeJobs: activeJobCount(),
    limits: {
      maxFileSize: config.maxFileSize,
      maxFiles: config.maxFiles,
      maxPdfPages: config.maxPdfPages,
      maxConcurrent: config.maxConcurrent,
    },
    formats: {
      input: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'tiff', 'gif', 'pdf'],
      output: ['jpg', 'png', 'webp', 'avif', 'tiff', 'pdf'],
    },
  }));
}
