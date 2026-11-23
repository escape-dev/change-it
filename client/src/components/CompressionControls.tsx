import { useState } from 'react';
import { ChevronDown, FileText, Lock, Maximize2, Settings2 } from 'lucide-react';
import { COMPRESSION_LEVELS, PDF_PAGE_FITS, TARGET_FORMATS } from '../lib/constants';
import type { CompressionLevel, OutputFormat, PageFit } from '../types';

interface CompressionControlsProps {
  target: OutputFormat;
  compression: CompressionLevel;
  onTargetChange: (target: OutputFormat) => void;
  onCompressionChange: (compression: CompressionLevel) => void;
  resizeEnabled: boolean;
  onResizeEnabledChange: (enabled: boolean) => void;
  resizeWidth: string;
  resizeHeight: string;
  onResizeWidthChange: (value: string) => void;
  onResizeHeightChange: (value: string) => void;
  pageFit: PageFit;
  onPageFitChange: (fit: PageFit) => void;
  showPageFit: boolean;
  disabled?: boolean;
}

export function CompressionControls({
  target,
  compression,
  onTargetChange,
  onCompressionChange,
  resizeEnabled,
  onResizeEnabledChange,
  resizeWidth,
  resizeHeight,
  onResizeWidthChange,
  onResizeHeightChange,
  pageFit,
  onPageFitChange,
  showPageFit,
  disabled = false,
}: CompressionControlsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedFormat = TARGET_FORMATS.find((format) => format.value === target);

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Output settings</h2>
          <p className="hint mt-0.5">Global defaults for this batch</p>
        </div>
        <button
          type="button"
          className="btn-ghost border border-white/5"
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Advanced
          <ChevronDown className={`h-3.5 w-3.5 transition ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="mt-4 space-y-1.5">
        <span className="field-label">Target format</span>
        <div className="grid grid-cols-3 gap-1.5">
          {TARGET_FORMATS.map((format) => {
            const active = target === format.value;
            return (
              <button
                key={format.value}
                type="button"
                disabled={disabled}
                title={format.note}
                onClick={() => onTargetChange(format.value)}
                className={[
                  'rounded-lg border px-2 py-2 text-xs font-semibold transition',
                  active
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-slate-950/50 text-slate-400 hover:border-white/20 hover:text-slate-200',
                  disabled ? 'cursor-not-allowed opacity-40' : '',
                ].join(' ')}
              >
                {format.label}
              </button>
            );
          })}
        </div>
        {selectedFormat && <p className="hint pt-0.5">{selectedFormat.note}</p>}
      </div>

      <div className="mt-4 space-y-1.5">
        <span className="field-label">Compression level</span>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-slate-950/50 p-1">
          {COMPRESSION_LEVELS.map((level) => {
            const active = compression === level.value;
            return (
              <button
                key={level.value}
                type="button"
                disabled={disabled}
                onClick={() => onCompressionChange(level.value)}
                className={[
                  'relative rounded-lg px-2 py-2 text-center transition',
                  active
                    ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200',
                  disabled ? 'cursor-not-allowed opacity-40' : '',
                ].join(' ')}
              >
                <span className="block text-xs font-semibold">{level.label}</span>
                <span className={`block text-[10px] ${active ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {level.note}
                </span>
              </button>
            );
          })}
        </div>
        <p className="flex items-start gap-1.5 pt-1 text-[11px] text-slate-500">
          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/80" />
          Presets preserve original pixel dimensions unless you enable resize.
        </p>
      </div>

      {advancedOpen && (
        <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onResizeEnabledChange(!resizeEnabled)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
                Resize dimensions
              </span>
              <span
                className={[
                  'relative h-5 w-9 shrink-0 rounded-full border transition',
                  resizeEnabled
                    ? 'border-emerald-400/50 bg-emerald-400/30'
                    : 'border-white/10 bg-white/5',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all',
                    resizeEnabled ? 'left-[18px] bg-emerald-300' : 'left-0.5 bg-slate-500',
                  ].join(' ')}
                />
              </span>
            </button>

            {resizeEnabled && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="field-label">Max width</span>
                  <input
                    type="number"
                    min={16}
                    max={20000}
                    inputMode="numeric"
                    placeholder="Auto"
                    className="field"
                    value={resizeWidth}
                    disabled={disabled}
                    onChange={(event) => onResizeWidthChange(event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="field-label">Max height</span>
                  <input
                    type="number"
                    min={16}
                    max={20000}
                    inputMode="numeric"
                    placeholder="Auto"
                    className="field"
                    value={resizeHeight}
                    disabled={disabled}
                    onChange={(event) => onResizeHeightChange(event.target.value)}
                  />
                </label>
                <p className="hint col-span-2">
                  Fits inside the box and keeps aspect ratio. Leave a field blank to derive it.
                </p>
              </div>
            )}
          </div>

          {showPageFit && (
            <label className="block space-y-1 border-t border-white/5 pt-3">
              <span className="field-label flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-slate-400" />
                PDF page size
              </span>
              <select
                className="field"
                value={pageFit}
                disabled={disabled}
                onChange={(event) => onPageFitChange(event.target.value as PageFit)}
              >
                {PDF_PAGE_FITS.map((fit) => (
                  <option key={fit.value} value={fit.value}>
                    {fit.label}
                  </option>
                ))}
              </select>
              <span className="hint">Applied when packing images into a PDF.</span>
            </label>
          )}
        </div>
      )}
    </section>
  );
}
