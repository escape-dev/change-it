export interface ErrorDetail {
  code: string;
  message: string;
  fileName?: string;
}

export interface IndexedError extends ErrorDetail {
  index: number;
}

export interface ResultDownload {
  name: string;
  url: string;
  size: number;
  page?: number;
}

export interface ConversionResult {
  id: string;
  kind: 'image' | 'pdf';
  fileName: string;
  sources: string[];
  inputFormat: string;
  outputFormat: string;
  compression: string;
  originalSize: number;
  outputSize: number;
  savedPercent: number;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
  resolutionPreserved?: boolean;
  pages?: number;
  durationMs: number;
  previewBefore?: string;
  previewAfter?: string;
  downloadUrl: string;
  downloads?: ResultDownload[];
  note?: string;
}

export interface ConvertResponse {
  jobId: string;
  results: ConversionResult[];
  errors: ErrorDetail[];
}
