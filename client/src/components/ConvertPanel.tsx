import { Loader2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { formatBytes } from '../lib/format';

interface ConvertPanelProps {
  fileCount: number;
  totalSize: number;
  isConverting: boolean;
  onConvert: () => void;
  onClear: () => void;
}

export function ConvertPanel({
  fileCount,
  totalSize,
  isConverting,
  onConvert,
  onClear,
}: ConvertPanelProps) {
  const canConvert = fileCount > 0 && !isConverting;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Ready to convert</h2>
          <p className="hint mt-0.5">
            {fileCount === 0
              ? 'Add files to begin'
              : `${fileCount} file${fileCount === 1 ? '' : 's'} · ${formatBytes(totalSize)}`}
          </p>
        </div>
        <span className="badge-muted">3 jobs max</span>
      </div>

      {isConverting && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-emerald-400/20 via-emerald-300 to-cyan-400/20" />
        </div>
      )}

      <button type="button" className="btn-primary mt-4 w-full" disabled={!canConvert} onClick={onConvert}>
        {isConverting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {fileCount === 0
              ? 'Add files to begin'
              : `Convert ${fileCount} file${fileCount === 1 ? '' : 's'}`}
          </>
        )}
      </button>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" />
          Temp files auto-delete
        </span>
        <button
          type="button"
          className="btn-ghost"
          onClick={onClear}
          disabled={fileCount === 0 || isConverting}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </section>
  );
}
