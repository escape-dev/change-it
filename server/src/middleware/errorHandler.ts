import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../utils/errors.js';

function errorCode(error: FastifyError): string {
  return typeof error.code === 'string' ? error.code : '';
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.fileName ? { fileName: error.fileName } : {}),
          ...(error.details && error.details.length > 0 ? { errors: error.details } : {}),
        },
      });
    }

    const code = errorCode(error);

    if (code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Each file must be 50 MB or smaller. Try compressing the file first.',
        },
      });
    }

    if (code === 'FST_FILES_LIMIT') {
      return reply.code(400).send({
        error: {
          code: 'TOO_MANY_FILES',
          message: 'You can upload up to 20 files in a single batch.',
        },
      });
    }

    if (code === 'FST_PARTS_LIMIT' || code === 'FST_FIELDS_LIMIT' || code === 'FST_FIELD_SIZE_LIMIT') {
      return reply.code(400).send({
        error: {
          code: 'INVALID_UPLOAD',
          message: 'The upload contained too many fields or parts. Please try again with fewer files.',
        },
      });
    }

    if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The request payload is too large.',
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');

    const status =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;

    return reply.code(status).send({
      error: {
        code: 'INTERNAL_ERROR',
        message:
          status === 500
            ? 'Something went wrong while processing your request. Please try again.'
            : error.message,
      },
    });
  });
}
