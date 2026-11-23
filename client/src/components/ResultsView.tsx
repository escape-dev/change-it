import { AlertTriangle, Archive, RefreshCw } from 'lucide-react';
import { formatBytes } from '../lib/format';
import type { ConversionError, ConversionResult } from '../types';
import { ResultCard } from './ResultCard';

interface ResultsViewProps {
  jobId: string;
  results: ConversionResult[];
  errors: ConversionError[];
  onReset: () => void;
}

export function ResultsView({ jobId, results, errors, onReset }: ResultsViewProps) {
  const totalOriginal = results.reduce((sum, result) => sum + result.originalSize, 0);
  const totalOutput = results.reduce((sum, result) => sum + result.outputSize, 0);
  const saved = totalOriginal > 0 ? Math.round((1 - totalOutput / totalOriginal) * 100) : 0;
  const canZip =
    results.length > 1 || results.some((result) => (result.downloads?.length ?? 0) > 1);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Results</h2>
            <span className="badge-muted">{results.length} converted</span>
          </div>
          <p className="hint mt-1">
            {formatBytes(totalOriginal)} → {formatBytes(totalOutput)} ·{' '}
            <span className={saved >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
              {Math.abs(saved)}% {saved >= 0 ? 'saved' : 'larger'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canZip && (
            <a className="btn-secondary" href={`/api/download/${jobId}/all`}>
              <Archive className="h-4 w-4" />
              Download all (.zip)
            </a>
          )}
          <button type="button" className="btn-secondary" onClick={onReset}>
            <RefreshCw className="h-4 w-4" />
            New batch
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {errors.length} file{errors.length === 1 ? '' : 's'} could not be processed
          </div>
          <ul className="mt-2 space-y-1.5">
            {errors.map((error, index) => (
              <li key={`${error.code}-${index}`} className="text-[11px] leading-relaxed text-rose-100/70">
                {error.fileName && <span className="font-medium text-rose-200">{error.fileName}: </span>}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {results.map((result) => (
          <ResultCard key={`${result.id}-${result.fileName}`} result={result} />
        ))}
      </div>

      <p className="hint text-center">
        Download links stay available for 20 minutes, then the workspace is deleted automatically.
      </p>
    </section>
  );
}
