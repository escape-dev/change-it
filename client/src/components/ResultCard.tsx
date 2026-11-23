import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileArchive,
  FileText,
  ImageDown,
  Scaling,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../lib/format';
import type { ConversionResult } from '../types';
import { CompareSlider } from './CompareSlider';

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

export function ResultCard({ result }: ResultCardProps) {
  const downloads = result.downloads ?? [];
  const hasPageList = downloads.length > 1;
  const hasCompare = Boolean(result.previewBefore && result.previewAfter);
  const resolution =
    result.width && result.height ? `${result.width} × ${result.height}` : null;
  const savedTone = result.savedPercent > 0 ? 'good' : result.savedPercent < 0 ? 'warn' : 'default';
  const savedValue = `${Math.abs(result.savedPercent)}%`;
  const savedHint =
    result.savedPercent > 0
      ? 'smaller'
      : result.savedPercent < 0
        ? 'larger than input'
        : 'no change';

  const isPdfOutput = result.outputFormat === 'pdf';

  return (
    <article className="card flex flex-col overflow-hidden">
      {hasCompare && (
        <CompareSlider
          before={result.previewBefore!}
          after={result.previewAfter!}
          alt={result.fileName}
        />
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
            : result.sources[0] ?? result.fileName}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            label="Resolution"
            value={resolution ?? '—'}
            hint={
              resolution
                ? result.resolutionPreserved
                  ? 'unchanged'
                  : 'resized'
                : undefined
            }
          />
          <Metric label="Original" value={formatBytes(result.originalSize)} />
          <Metric label="New size" value={formatBytes(result.outputSize)} />
          <Metric
            label="Saved"
            value={savedValue}
            hint={savedHint}
            tone={savedTone}
          />
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

          {hasPageList && (
            <details className="group rounded-lg border border-white/5 bg-slate-950/40">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] text-slate-400 [&::-webkit-details-marker]:hidden">
                <span>Individual pages ({downloads.length})</span>
                <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>
              <ul className="max-h-40 space-y-0.5 overflow-auto border-t border-white/5 p-1.5">
                {downloads.map((download) => (
                  <li key={download.url}>
                    <a
                      href={download.url}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                    >
                      <span className="truncate">
                        {download.page ? `Page ${download.page}` : download.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
                        {formatBytes(download.size)}
                        <ImageDown className="h-3 w-3" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}
