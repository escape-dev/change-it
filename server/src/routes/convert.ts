import type { FastifyInstance } from 'fastify';
import { createJob, removeJob, removeJobInputs } from '../jobs/jobStore.js';
import { convertUploads } from '../services/conversionService.js';
import { readUploadRequest } from '../services/uploadService.js';

export async function convertRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/convert', async (request, reply) => {
    const job = await createJob();

    try {
      const { options, uploads } = await readUploadRequest(request, job);
      const response = await convertUploads({
        job,
        options,
        uploads,
        logger: request.log,
      });

      return reply.send(response);
    } catch (error) {
      await removeJob(job.id);
      throw error;
    } finally {
      await removeJobInputs(job);
    }
  });
}
