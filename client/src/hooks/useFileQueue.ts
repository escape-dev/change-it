import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_FILES } from '../lib/constants';
import { prepareQueuedFiles } from '../lib/queue';
import type { CompressionLevel, OutputFormat, QueuedFile } from '../types';

function patchFile(
  files: QueuedFile[],
  id: string,
  update: (file: QueuedFile) => QueuedFile,
): QueuedFile[] {
  return files.map((file) => (file.id === id ? update(file) : file));
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

      const { accepted, problems } = prepareQueuedFiles(incoming, current.length, {
        targetFormat: globalTarget,
        compression: globalCompression,
      });

      for (const item of accepted) {
        if (item.previewUrl) objectUrls.current.add(item.previewUrl);
      }

      commit([...current, ...accepted]);
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
        patchFile(filesRef.current, id, (item) => ({
          ...item,
          targetFormat: target,
          overrides: { ...item.overrides, targetFormat: target !== globalTarget },
        })),
      );
    },
    [commit, globalTarget],
  );

  const setFileCompression = useCallback(
    (id: string, compression: CompressionLevel) => {
      commit(
        patchFile(filesRef.current, id, (item) => ({
          ...item,
          compression,
          overrides: { ...item.overrides, compression: compression !== globalCompression },
        })),
      );
    },
    [commit, globalCompression],
  );

  const syncFile = useCallback(
    (id: string) => {
      commit(
        patchFile(filesRef.current, id, (item) => ({
          ...item,
          targetFormat: globalTarget,
          compression: globalCompression,
          overrides: { targetFormat: false, compression: false },
        })),
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

  const totalSize = useMemo(
    () => files.reduce((sum, item) => sum + item.size, 0),
    [files],
  );

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
