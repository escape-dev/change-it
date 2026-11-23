import { FileText, Maximize2 } from 'lucide-react';
import {
  MAX_RESIZE_DIMENSION,
  MIN_RESIZE_DIMENSION,
  PDF_PAGE_FITS,
} from '../../lib/constants';
import type { PageFit } from '../../types';

interface AdvancedOptionsProps {
  disabled?: boolean;
  resizeEnabled: boolean;
  onResizeEnabledChange: (enabled: boolean) => void;
  resizeWidth: string;
  resizeHeight: string;
  onResizeWidthChange: (value: string) => void;
  onResizeHeightChange: (value: string) => void;
  pageFit: PageFit;
  onPageFitChange: (fit: PageFit) => void;
  showPageFit: boolean;
}

function ToggleSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      className={[
        'relative h-5 w-9 shrink-0 rounded-full border transition',
        checked ? 'border-emerald-400/50 bg-emerald-400/30' : 'border-white/10 bg-white/5',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all',
          checked ? 'left-[18px] bg-emerald-300' : 'left-0.5 bg-slate-500',
        ].join(' ')}
      />
    </span>
  );
}

function ResizeFields({
  disabled,
  resizeWidth,
  resizeHeight,
  onResizeWidthChange,
  onResizeHeightChange,
}: Pick<
  AdvancedOptionsProps,
  'disabled' | 'resizeWidth' | 'resizeHeight' | 'onResizeWidthChange' | 'onResizeHeightChange'
>) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <label className="space-y-1">
        <span className="field-label">Max width</span>
        <input
          type="number"
          min={MIN_RESIZE_DIMENSION}
          max={MAX_RESIZE_DIMENSION}
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
          min={MIN_RESIZE_DIMENSION}
          max={MAX_RESIZE_DIMENSION}
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
  );
}

export function AdvancedOptions({
  disabled = false,
  resizeEnabled,
  onResizeEnabledChange,
  resizeWidth,
  resizeHeight,
  onResizeWidthChange,
  onResizeHeightChange,
  pageFit,
  onPageFitChange,
  showPageFit,
}: AdvancedOptionsProps) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-slate-950/40 p-3">
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
          <ToggleSwitch checked={resizeEnabled} />
        </button>

        {resizeEnabled && (
          <ResizeFields
            disabled={disabled}
            resizeWidth={resizeWidth}
            resizeHeight={resizeHeight}
            onResizeWidthChange={onResizeWidthChange}
            onResizeHeightChange={onResizeHeightChange}
          />
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
  );
}
