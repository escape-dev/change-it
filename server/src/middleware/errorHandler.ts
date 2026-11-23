import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

function errorCode(error: FastifyError): string {
  return typeof error.code === 'string' ? error.code : '';
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
): FastifyReply {
  return reply.code(statusCode).send({ error: { code, message } });
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

    switch (errorCode(error)) {
      case 'FST_REQ_FILE_TOO_LARGE':
        return sendError(
          reply,
          413,
          'FILE_TOO_LARGE',
          `Each file must be ${config.maxFileSizeLabel} or smaller.`,
        );

      case 'FST_FILES_LIMIT':
        return sendError(
          reply,
          400,
          'TOO_MANY_FILES',
          `You can upload up to ${config.maxFiles} files in a single batch.`,
        );

      case 'FST_PARTS_LIMIT':
      case 'FST_FIELDS_LIMIT':
      case 'FST_FIELD_SIZE_LIMIT':
        return sendError(
          reply,
          400,
          'INVALID_UPLOAD',
          'The upload contained too many fields or parts. Please try again with fewer files.',
        );

      case 'FST_ERR_CTP_BODY_TOO_LARGE':
        return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', 'The request payload is too large.');
    }

    request.log.error({ err: error }, 'unhandled request error');

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
