import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_FILES, MAX_FILE_SIZE, guessFormat, isBrowserPreviewable, isSupportedInput } from '../lib/constants';
import type { CompressionLevel, OutputFormat } from '../types';

export interface QueuedFile {
  id: string;
  file: File;
  previewUrl?: string;
  format: string;
  size: number;
  targetFormat: OutputFormat;
  compression: CompressionLevel;
  overrides: {
    targetFormat: boolean;
    compression: boolean;
  };
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useFileQueue() {
  const [files, setFilesState] = useState<QueuedFile[]>([]);
  const filesRef = useRef<QueuedFile[]>([]);
  const objectUrls = useRef<Set<string>>(new Set());

  const [globalTarget, setGlobalTargetState] = useState<OutputFormat>('webp');
  const [globalCompression, setGlobalCompressionState] = useState<CompressionLevel>('medium');
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback((next: QueuedFile[]) => {
    filesRef.current = next;
    setFilesState(next);
  }, []);

  const releaseUrl = useCallback((url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  }, []);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const current = filesRef.current;
      if (current.length >= MAX_FILES) {
        setError(`You can add up to ${MAX_FILES} files at once.`);
        return;
      }

      const next = [...current];
      const problems: string[] = [];

      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          problems.push(`Only the first ${MAX_FILES} files were added.`);
          break;
        }
        if (file.size === 0) {
          problems.push(`"${file.name}" is empty and was skipped.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          problems.push(`"${file.name}" is larger than 50 MB and was skipped.`);
          continue;
        }

        const format = guessFormat(file);
        if (!isSupportedInput(format)) {
          problems.push(`"${file.name}" is not a supported file type.`);
          continue;
        }

        const previewUrl = isBrowserPreviewable(format) ? URL.createObjectURL(file) : undefined;
        if (previewUrl) objectUrls.current.add(previewUrl);

        next.push({
          id: makeId(),
          file,
          ...(previewUrl ? { previewUrl } : {}),
          format,
          size: file.size,
          targetFormat: globalTarget,
          compression: globalCompression,
          overrides: { targetFormat: false, compression: false },
        });
      }

      commit(next);
      setError(problems.length > 0 ? problems.join(' ') : null);
    },
    [commit, globalTarget, globalCompression],
  );

  const removeFile = useCallback(
    (id: string) => {
      const target = filesRef.current.find((item) => item.id === id);
      if (target) releaseUrl(target.previewUrl);
      commit(filesRef.current.filter((item) => item.id !== id));
    },
    [commit, releaseUrl],
  );

  const clearFiles = useCallback(() => {
    for (const item of filesRef.current) releaseUrl(item.previewUrl);
    commit([]);
    setError(null);
  }, [commit, releaseUrl]);

  const updateGlobalTarget = useCallback(
    (target: OutputFormat) => {
      setGlobalTargetState(target);
      commit(
        filesRef.current.map((item) =>
          item.overrides.targetFormat ? item : { ...item, targetFormat: target },
        ),
      );
    },
    [commit],
  );

  const updateGlobalCompression = useCallback(
    (compression: CompressionLevel) => {
      setGlobalCompressionState(compression);
      commit(
        filesRef.current.map((item) =>
          item.overrides.compression ? item : { ...item, compression },
        ),
      );
    },
    [commit],
  );

  const setFileTarget = useCallback(
    (id: string, target: OutputFormat) => {
      commit(
        filesRef.current.map((item) =>
          item.id === id
            ? {
                ...item,
                targetFormat: target,
                overrides: { ...item.overrides, targetFormat: target !== globalTarget },
              }
            : item,
        ),
      );
    },
    [commit, globalTarget],
  );

  const setFileCompression = useCallback(
    (id: string, compression: CompressionLevel) => {
      commit(
        filesRef.current.map((item) =>
          item.id === id
            ? {
                ...item,
                compression,
                overrides: {
                  ...item.overrides,
                  compression: compression !== globalCompression,
                },
              }
            : item,
        ),
      );
    },
    [commit, globalCompression],
  );

  const syncFile = useCallback(
    (id: string) => {
      commit(
        filesRef.current.map((item) =>
          item.id === id
            ? {
                ...item,
                targetFormat: globalTarget,
                compression: globalCompression,
                overrides: { targetFormat: false, compression: false },
              }
            : item,
        ),
      );
    },
    [commit, globalTarget, globalCompression],
  );

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const totalSize = files.reduce((sum, item) => sum + item.size, 0);

  return {
    files,
    totalSize,
    globalTarget,
    globalCompression,
    error,
    setError,
    addFiles,
    removeFile,
    clearFiles,
    updateGlobalTarget,
    updateGlobalCompression,
    setFileTarget,
    setFileCompression,
    syncFile,
  };
}
