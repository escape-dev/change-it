import {
  ArrowRight,
  Check,
  Clock,
  Download,
  FileArchive,
  FileText,
  Scaling,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../lib/format';
import type { ConversionResult } from '../types';
import { CompareSlider } from './CompareSlider';
import { PageDownloads } from './PageDownloads';

interface ResultCardProps {
  result: ConversionResult;
}

function formatLabel(value: string): string {
  return value.toUpperCase();
}

function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-100';

  return (
    <div className="rounded-lg border border-white/5 bg-slate-950/40 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

interface ResultMetrics {
  resolution: string | null;
  savedTone: 'default' | 'good' | 'warn';
  savedValue: string;
  savedHint: string;
}

function resultMetrics(result: ConversionResult): ResultMetrics {
  const resolution = result.width && result.height ? `${result.width} × ${result.height}` : null;
  const savedTone: ResultMetrics['savedTone'] =
    result.savedPercent > 0 ? 'good' : result.savedPercent < 0 ? 'warn' : 'default';
  const savedHint =
    result.savedPercent > 0
      ? 'smaller'
      : result.savedPercent < 0
        ? 'larger than input'
        : 'no change';

  return {
    resolution,
    savedTone,
    savedValue: `${Math.abs(result.savedPercent)}%`,
    savedHint,
  };
}

export function ResultCard({ result }: ResultCardProps) {
  const downloads = result.downloads ?? [];
  const hasPageList = downloads.length > 1;
  const isPdfOutput = result.outputFormat === 'pdf';
  const { resolution, savedTone, savedValue, savedHint } = resultMetrics(result);

  const compare =
    result.previewBefore && result.previewAfter
      ? { before: result.previewBefore, after: result.previewAfter }
      : null;

  return (
    <article className="card flex flex-col overflow-hidden">
      {compare && (
        <CompareSlider before={compare.before} after={compare.after} alt={result.fileName} />
      )}

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge">
            {formatLabel(result.inputFormat)}
            <ArrowRight className="h-3 w-3" />
            {formatLabel(result.outputFormat)}
          </span>
          <span className="badge-muted">{result.compression}</span>
          {result.pages ? (
            <span className="badge-muted">
              <FileText className="h-3 w-3" />
              {result.pages} page{result.pages === 1 ? '' : 's'}
            </span>
          ) : null}
          {result.resolutionPreserved && (
            <span className="badge-muted">
              <Check className="h-3 w-3 text-emerald-300" />
              Res preserved
            </span>
          )}
        </div>

        <h3 className="mt-2.5 truncate text-sm font-semibold text-slate-100" title={result.fileName}>
          {result.fileName}
        </h3>
        <p className="mt-0.5 truncate text-[11px] text-slate-500" title={result.sources.join(', ')}>
          {result.sources.length > 1
            ? `From ${result.sources.length} images: ${result.sources.join(', ')}`
            : (result.sources[0] ?? result.fileName)}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Resolution"
            value={resolution ?? '—'}
            hint={
              resolution ? (result.resolutionPreserved ? 'unchanged' : 'resized') : undefined
            }
          />
          <Metric label="Original" value={formatBytes(result.originalSize)} />
          <Metric label="New size" value={formatBytes(result.outputSize)} />
          <Metric label="Saved" value={savedValue} hint={savedHint} tone={savedTone} />
        </div>

        {result.note && (
          <p className="mt-2.5 rounded-lg border border-amber-400/15 bg-amber-400/5 px-2.5 py-1.5 text-[11px] text-amber-200/90">
            {result.note}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(result.durationMs)}
          </span>
          {result.width && result.height && (
            <span className="inline-flex items-center gap-1">
              <Scaling className="h-3 w-3" />
              {result.width} × {result.height}
            </span>
          )}
        </div>

        <div className="mt-auto space-y-2 pt-4">
          <a className="btn-primary w-full" href={result.downloadUrl}>
            {hasPageList ? (
              <FileArchive className="h-4 w-4" />
            ) : isPdfOutput ? (
              <FileText className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {hasPageList ? 'Download pages (.zip)' : isPdfOutput ? 'Download PDF' : 'Download'}
          </a>

          <PageDownloads downloads={downloads} />
        </div>
      </div>
    </article>
  );
}
