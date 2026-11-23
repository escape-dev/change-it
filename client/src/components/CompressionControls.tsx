import { useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import type { CompressionLevel, OutputFormat, PageFit } from '../types';
import { AdvancedOptions } from './settings/AdvancedOptions';
import { CompressionPicker } from './settings/CompressionPicker';
import { FormatPicker } from './settings/FormatPicker';

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

      <div className="mt-4">
        <FormatPicker value={target} onChange={onTargetChange} disabled={disabled} />
      </div>

      <div className="mt-4">
        <CompressionPicker
          value={compression}
          onChange={onCompressionChange}
          disabled={disabled}
        />
      </div>

      {advancedOpen && (
        <div className="mt-4">
          <AdvancedOptions
            disabled={disabled}
            resizeEnabled={resizeEnabled}
            onResizeEnabledChange={onResizeEnabledChange}
            resizeWidth={resizeWidth}
            resizeHeight={resizeHeight}
            onResizeWidthChange={onResizeWidthChange}
            onResizeHeightChange={onResizeHeightChange}
            pageFit={pageFit}
            onPageFitChange={onPageFitChange}
            showPageFit={showPageFit}
          />
        </div>
      )}
    </section>
  );
}
