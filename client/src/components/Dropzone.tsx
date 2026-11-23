import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ClipboardPaste, FileUp, ImagePlus, UploadCloud } from 'lucide-react';
import { ACCEPT_ATTR } from '../lib/constants';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({ onFiles, disabled = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleSelection = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleSelection(event.dataTransfer.files);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload files"
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={[
        'group relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-dashed px-6 py-10 text-center transition',
        dragging
          ? 'border-emerald-400/70 bg-emerald-400/[0.07]'
          : 'border-white/15 bg-white/[0.025] hover:border-emerald-400/40 hover:bg-white/[0.04]',
        disabled ? 'pointer-events-none opacity-50' : '',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleSelection(event.target.files);
          event.target.value = '';
        }}
      />

      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-slate-950/60 text-emerald-300 transition group-hover:scale-105">
        <UploadCloud className="h-6 w-6" strokeWidth={2} />
      </div>

      <div className="space-y-1">
        <p className="text-base font-medium text-slate-100">
          Drop files here or <span className="text-emerald-300">browse</span>
        </p>
        <p className="hint">JPG, PNG, WebP, AVIF, HEIC, TIFF, GIF, and PDF</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-slate-500">
        <span className="inline-flex items-center gap-1.5 text-[11px]">
          <ImagePlus className="h-3.5 w-3.5" />
          Multi-file
        </span>
        <span className="text-white/10">|</span>
        <span className="inline-flex items-center gap-1.5 text-[11px]">
          <ClipboardPaste className="h-3.5 w-3.5" />
          Ctrl+V to paste
        </span>
        <span className="text-white/10">|</span>
        <span className="inline-flex items-center gap-1.5 text-[11px]">
          <FileUp className="h-3.5 w-3.5" />
          50 MB max each
        </span>
      </div>
    </div>
  );
}
