import { Lock } from 'lucide-react';
import { COMPRESSION_LEVELS } from '../../lib/constants';
import type { CompressionLevel } from '../../types';

interface CompressionPickerProps {
  value: CompressionLevel;
  onChange: (value: CompressionLevel) => void;
  disabled?: boolean;
}

export function CompressionPicker({ value, onChange, disabled = false }: CompressionPickerProps) {
  return (
    <div className="space-y-1.5">
      <span className="field-label">Compression level</span>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-slate-950/50 p-1">
        {COMPRESSION_LEVELS.map((level) => {
          const isActive = level.value === value;

          return (
            <button
              key={level.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(level.value)}
              className={[
                'rounded-lg px-2 py-2 text-center transition',
                isActive
                  ? 'bg-gradient-to-b from-white/15 to-white/5 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200',
                disabled ? 'cursor-not-allowed opacity-40' : '',
              ].join(' ')}
            >
              <span className="block text-xs font-semibold">{level.label}</span>
              <span
                className={`block text-[10px] ${isActive ? 'text-emerald-300' : 'text-slate-500'}`}
              >
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
  );
}
