import { useEffect } from 'react';
import { guessFormat, isSupportedInput } from '../lib/constants';

function normalizePastedFile(file: File): File {
  if (file.name && file.name.includes('.')) return file;
  const format = guessFormat(file);
  const extension = format === 'jpg' ? 'jpg' : format === 'tiff' ? 'tiff' : format === 'unknown' ? 'png' : format;
  return new File([file], `pasted-${Date.now()}.${extension}`, {
    type: file.type || 'image/png',
    lastModified: Date.now(),
  });
}

export function useClipboardPaste(onFiles: (files: File[]) => void): void {
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const files: File[] = [];
      if (clipboard.files && clipboard.files.length > 0) {
        files.push(...Array.from(clipboard.files));
      } else {
        for (const item of Array.from(clipboard.items ?? [])) {
          if (item.kind !== 'file') continue;
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      const usable = files.filter((file) => {
        if (file.type.startsWith('image/') || file.type === 'application/pdf') return true;
        return isSupportedInput(guessFormat(file));
      });

      if (usable.length === 0) return;

      event.preventDefault();
      onFiles(usable.map(normalizePastedFile));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFiles]);
}
