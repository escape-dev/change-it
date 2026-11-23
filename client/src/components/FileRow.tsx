import { FileText, Image as ImageIcon, RotateCcw, X } from 'lucide-react';
import { COMPRESSION_LEVELS, TARGET_FORMATS } from '../lib/constants';
import { formatBytes } from '../lib/format';
import type { QueuedFile } from '../hooks/useFileQueue';
import type { CompressionLevel, OutputFormat } from '../types';

interface FileRowProps {
  item: QueuedFile;
  disabled?: boolean;
  onRemove: (id: string) => void;
  onTargetChange: (id: string, target: OutputFormat) => void;
  onCompressionChange: (id: string, compression: CompressionLevel) => void;
  onSync: (id: string) => void;
}

export function FileRow({
  item,
  disabled = false,
  onRemove,
  onTargetChange,
  onCompressionChange,
  onSync,
}: FileRowProps) {
  const customized = item.overrides.targetFormat || item.overrides.compression;
  const isPdf = item.format === 'pdf';

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 transition hover:border-white/10 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-slate-900">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : isPdf ? (
            <FileText className="h-5 w-5 text-rose-300" />
          ) : (
            <ImageIcon className="h-5 w-5 text-slate-500" />
          )}
          <span className="absolute bottom-0 right-0 rounded-tl-md bg-slate-950/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-300">
            {item.format}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-200" title={item.file.name}>
              {item.file.name}
            </p>
            {customized && (
              <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                custom
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {formatBytes(item.size)} · {item.format.toUpperCase()}
            {isPdf ? ' · pages will be rendered' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`target-${item.id}`}>
          Target format for {item.file.name}
        </label>
        <select
          id={`target-${item.id}`}
          className="field h-9 w-[104px] py-1 text-xs"
          value={item.targetFormat}
          disabled={disabled}
          onChange={(event) => onTargetChange(item.id, event.target.value as OutputFormat)}
        >
          {TARGET_FORMATS.map((format) => (
            <option key={format.value} value={format.value}>
              {format.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor={`compression-${item.id}`}>
          Compression for {item.file.name}
        </label>
        <select
          id={`compression-${item.id}`}
          className="field h-9 w-[112px] py-1 text-xs"
          value={item.compression}
          disabled={disabled}
          onChange={(event) => onCompressionChange(item.id, event.target.value as CompressionLevel)}
        >
          {COMPRESSION_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
              {level.recommended ? ' (rec.)' : ''}
            </option>
          ))}
        </select>

        {customized && (
          <button
            type="button"
            className="btn-ghost h-9"
            onClick={() => onSync(item.id)}
            disabled={disabled}
            title="Reset to global settings"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Sync
          </button>
        )}

        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
          onClick={() => onRemove(item.id)}
          disabled={disabled}
          aria-label={`Remove ${item.file.name}`}
          title="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
