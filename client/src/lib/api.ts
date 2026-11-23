import type { ConversionError, ConvertOptionsPayload, ConvertResponse } from '../types';

export class ApiClientError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly errors?: ConversionError[];

  constructor(message: string, code?: string, status?: number, errors?: ConversionError[]) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.errors = errors;
  }
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    errors?: ConversionError[];
  };
  errors?: ConversionError[];
}

const NETWORK_ERROR_MESSAGE =
  'Could not reach the server. Check that it is running and try again.';

function createFormData(files: File[], payload: ConvertOptionsPayload): FormData {
  const form = new FormData();
  form.append('options', JSON.stringify(payload));

  for (const file of files) {
    form.append('files', file, file.name || 'upload');
  }

  return form;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toApiClientError(data: unknown, status: number): ApiClientError {
  const body = (data ?? {}) as ErrorBody;
  const detail = body.error;

  return new ApiClientError(
    detail?.message ?? `Conversion failed (HTTP ${status}).`,
    detail?.code ?? 'REQUEST_FAILED',
    status,
    detail?.errors ?? body.errors,
  );
}

export async function convertFiles(
  files: File[],
  payload: ConvertOptionsPayload,
): Promise<ConvertResponse> {
  let response: Response;

  try {
    response = await fetch('/api/convert', {
      method: 'POST',
      body: createFormData(files, payload),
    });
  } catch {
    throw new ApiClientError(NETWORK_ERROR_MESSAGE, 'NETWORK_ERROR');
  }

  const data = await readJson(response);

  if (!response.ok) {
    throw toApiClientError(data, response.status);
  }

  return data as ConvertResponse;
}
