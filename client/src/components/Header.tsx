import { ArrowLeftRight, Layers, ShieldCheck, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/25">
          <ArrowLeftRight className="h-5 w-5 text-slate-950" strokeWidth={2.6} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Change <span className="text-emerald-400">IT</span>
          </h1>
          <p className="text-sm text-slate-400">Compress. Convert. Done.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
          sharp powered
        </span>
        <span className="chip">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          50 MB per file
        </span>
        <span className="chip">
          <Layers className="h-3.5 w-3.5 text-emerald-400" />
          20 files per batch
        </span>
      </div>
    </header>
  );
}
