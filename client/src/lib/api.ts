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

export async function convertFiles(
  files: File[],
  payload: ConvertOptionsPayload,
): Promise<ConvertResponse> {
  const form = new FormData();
  form.append('options', JSON.stringify(payload));

  for (const file of files) {
    form.append('files', file, file.name || 'upload');
  }

  let response: Response;
  try {
    response = await fetch('/api/convert', { method: 'POST', body: form });
  } catch {
    throw new ApiClientError(
      'Could not reach the server. Check that it is running and try again.',
      'NETWORK_ERROR',
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const body = (data ?? {}) as ErrorBody;
    const detail = body.error;
    throw new ApiClientError(
      detail?.message ?? `Conversion failed (HTTP ${response.status}).`,
      detail?.code ?? 'REQUEST_FAILED',
      response.status,
      detail?.errors ?? body.errors,
    );
  }

  return data as ConvertResponse;
}
