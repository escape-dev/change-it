export type CompressionLevel = 'low' | 'medium' | 'high';
export type OutputFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'tiff' | 'pdf';
export type PageFit = 'original' | 'a4' | 'letter';

export interface ResizeOptions {
  width?: number;
  height?: number;
}

export interface FileOverridePayload {
  targetFormat?: OutputFormat;
  compression?: CompressionLevel;
}

export interface ConvertOptionsPayload {
  targetFormat: OutputFormat;
  compression: CompressionLevel;
  pageFit: PageFit;
  resize: ResizeOptions | null;
  perFile: (FileOverridePayload | null)[];
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

export interface ConversionError {
  code: string;
  message: string;
  fileName?: string;
}

export interface ConvertResponse {
  jobId: string;
  results: ConversionResult[];
  errors: ConversionError[];
}
