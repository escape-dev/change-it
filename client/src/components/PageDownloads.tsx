import { ChevronDown, ImageDown } from 'lucide-react';
import { formatBytes } from '../lib/format';
import type { ResultDownload } from '../types';

interface PageDownloadsProps {
  downloads: ResultDownload[];
}

export function PageDownloads({ downloads }: PageDownloadsProps) {
  if (downloads.length <= 1) return null;

  return (
    <details className="group rounded-lg border border-white/5 bg-slate-950/40">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] text-slate-400 [&::-webkit-details-marker]:hidden">
        <span>Individual pages ({downloads.length})</span>
        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
      </summary>

      <ul className="max-h-40 space-y-0.5 overflow-auto border-t border-white/5 p-1.5">
        {downloads.map((download) => (
          <li key={download.url}>
            <a
              href={download.url}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              <span className="truncate">
                {download.page ? `Page ${download.page}` : download.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
                {formatBytes(download.size)}
                <ImageDown className="h-3 w-3" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
