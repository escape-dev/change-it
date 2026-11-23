import { useState } from 'react';
import { GripVertical } from 'lucide-react';

interface CompareSliderProps {
  before: string;
  after: string;
  alt: string;
}

export function CompareSlider({ before, after, alt }: CompareSliderProps) {
  const [position, setPosition] = useState(50);

  return (
    <div className="relative h-72 w-full select-none overflow-hidden border-t border-white/5 bg-slate-950 sm:h-80">
      <div className="checkerboard absolute inset-0" />

      <img
        src={after}
        alt={`${alt} after conversion`}
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />
      <img
        src={before}
        alt={`${alt} before conversion`}
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />

      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-emerald-300/90"
        style={{ left: `${position}%` }}
      >
        <div className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-emerald-300/60 bg-slate-950/90 shadow-lg">
          <GripVertical className="h-4 w-4 text-emerald-300" />
        </div>
      </div>

      <span className="badge absolute left-3 top-3 z-20">Before</span>
      <span className="badge absolute right-3 top-3 z-20">After</span>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        aria-label="Compare original and converted image"
        onChange={(event) => setPosition(Number(event.target.value))}
        className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
