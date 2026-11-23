import { TARGET_FORMATS } from '../../lib/constants';
import type { OutputFormat } from '../../types';

interface FormatPickerProps {
  value: OutputFormat;
  onChange: (value: OutputFormat) => void;
  disabled?: boolean;
}

export function FormatPicker({ value, onChange, disabled = false }: FormatPickerProps) {
  const selected = TARGET_FORMATS.find((format) => format.value === value);

  return (
    <div className="space-y-1.5">
      <span className="field-label">Target format</span>

      <div className="grid grid-cols-3 gap-1.5">
        {TARGET_FORMATS.map((format) => {
          const isActive = format.value === value;

          return (
            <button
              key={format.value}
              type="button"
              disabled={disabled}
              title={format.note}
              onClick={() => onChange(format.value)}
              className={[
                'rounded-lg border px-2 py-2 text-xs font-semibold transition',
                isActive
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

      {selected && <p className="hint pt-0.5">{selected.note}</p>}
    </div>
  );
}
