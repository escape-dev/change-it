import { useRef, useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { Header } from './components/Header';
import { Dropzone } from './components/Dropzone';
import { FileRow } from './components/FileRow';
import { CompressionControls } from './components/CompressionControls';
import { ConvertPanel } from './components/ConvertPanel';
import { ResultsView } from './components/ResultsView';
import { Notice } from './components/Notice';
import { useFileQueue } from './hooks/useFileQueue';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { ApiClientError, convertFiles } from './lib/api';
import { formatBytes } from './lib/format';
import type {
  ConversionError,
  ConvertOptionsPayload,
  ConvertResponse,
  FileOverridePayload,
  PageFit,
  ResizeOptions,
} from './types';

function parseDimension(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 16 || value > 20000) return Number.NaN;
  return value;
}

export default function App() {
  const queue = useFileQueue();
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [pageFit, setPageFit] = useState<PageFit>('original');
  const [isConverting, setIsConverting] = useState(false);
  const [response, setResponse] = useState<ConvertResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [apiErrors, setApiErrors] = useState<ConversionError[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  useClipboardPaste(queue.addFiles);

  const showPageFit = queue.files.some((item) => item.targetFormat === 'pdf');
  const pdfGroupCount = queue.files.filter((item) => item.targetFormat === 'pdf').length;

  const dismissError = () => {
    setRequestError(null);
    setApiErrors([]);
  };

  const handleConvert = async () => {
    if (queue.files.length === 0 || isConverting) return;

    setRequestError(null);
    setApiErrors([]);

    const pdfToPdf = queue.files.find(
      (item) => item.format === 'pdf' && item.targetFormat === 'pdf',
    );
    if (pdfToPdf) {
      setRequestError(
        `"${pdfToPdf.file.name}" is a PDF. Choose JPG, PNG, WebP, AVIF, or TIFF as its target to render its pages.`,
      );
      return;
    }

    const width = parseDimension(resizeWidth);
    const height = parseDimension(resizeHeight);
    if (Number.isNaN(width) || Number.isNaN(height)) {
      setRequestError('Resize dimensions must be whole numbers between 16 and 20000 px.');
      return;
    }

    const resize: ResizeOptions | null =
      resizeEnabled && (width !== undefined || height !== undefined)
        ? {
            ...(width !== undefined ? { width } : {}),
            ...(height !== undefined ? { height } : {}),
          }
        : null;

    if (resizeEnabled && !resize) {
      setRequestError('Enter a width or height to use resize, or turn resize off.');
      return;
    }

    const perFile = queue.files.map((item) => {
      const override: FileOverridePayload = {};
      if (item.overrides.targetFormat) override.targetFormat = item.targetFormat;
      if (item.overrides.compression) override.compression = item.compression;
      return Object.keys(override).length > 0 ? override : null;
    });

    const payload: ConvertOptionsPayload = {
      targetFormat: queue.globalTarget,
      compression: queue.globalCompression,
      pageFit,
      resize,
      perFile,
    };

    setIsConverting(true);
    try {
      const data = await convertFiles(
        queue.files.map((item) => item.file),
        payload,
      );
      setResponse(data);
      setApiErrors(data.errors ?? []);
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    } catch (error) {
      setResponse(null);
      if (error instanceof ApiClientError) {
        setRequestError(error.message);
        setApiErrors(error.errors ?? []);
      } else {
        setRequestError('Something unexpected happened. Please try again.');
        setApiErrors([]);
      }
    } finally {
      setIsConverting(false);
    }
  };

  const handleResetAll = () => {
    queue.clearFiles();
    setResponse(null);
    setApiErrors([]);
    setRequestError(null);
  };

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <Header />

        <main className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <Dropzone onFiles={queue.addFiles} disabled={isConverting} />

              {queue.error && (
                <Notice tone="warning" title="Some files were skipped" onDismiss={() => queue.setError(null)}>
                  {queue.error}
                </Notice>
              )}

              {requestError && (
                <Notice tone="error" title="Could not convert" onDismiss={dismissError}>
                  <p>{requestError}</p>
                  {!response && apiErrors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {apiErrors.map((item, index) => (
                        <li key={`${item.code}-${index}`}>
                          {item.fileName && (
                            <span className="font-medium text-rose-200">{item.fileName}: </span>
                          )}
                          {item.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </Notice>
              )}

              {queue.files.length > 0 && (
                <section className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-100">
                      Files <span className="text-slate-500">({queue.files.length})</span>
                    </h2>
                    <span className="hint">{formatBytes(queue.totalSize)} total</span>
                  </div>

                  <ul className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                    {queue.files.map((item) => (
                      <FileRow
                        key={item.id}
                        item={item}
                        disabled={isConverting}
                        onRemove={queue.removeFile}
                        onTargetChange={queue.setFileTarget}
                        onCompressionChange={queue.setFileCompression}
                        onSync={queue.syncFile}
                      />
                    ))}
                  </ul>

                  <p className="hint mt-3 flex items-start gap-1.5">
                    <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                    Override format or compression per file. Every image set to PDF is packed into one
                    multi-page document.
                  </p>
                </section>
              )}
            </div>

            <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              <CompressionControls
                target={queue.globalTarget}
                compression={queue.globalCompression}
                onTargetChange={queue.updateGlobalTarget}
                onCompressionChange={queue.updateGlobalCompression}
                resizeEnabled={resizeEnabled}
                onResizeEnabledChange={setResizeEnabled}
                resizeWidth={resizeWidth}
                resizeHeight={resizeHeight}
                onResizeWidthChange={setResizeWidth}
                onResizeHeightChange={setResizeHeight}
                pageFit={pageFit}
                onPageFitChange={setPageFit}
                showPageFit={showPageFit}
                disabled={isConverting}
              />

              {queue.globalTarget === 'pdf' && pdfGroupCount > 1 && (
                <Notice tone="info">
                  {pdfGroupCount} images will be packed into one multi-page PDF using{' '}
                  {pageFit === 'original' ? 'their original page size' : pageFit.toUpperCase()}.
                </Notice>
              )}

              <ConvertPanel
                fileCount={queue.files.length}
                totalSize={queue.totalSize}
                isConverting={isConverting}
                onConvert={handleConvert}
                onClear={handleResetAll}
              />
            </div>
          </div>

          <div ref={resultsRef} className="scroll-mt-6">
            {response && (
              <ResultsView
                jobId={response.jobId}
                results={response.results}
                errors={apiErrors}
                onReset={handleResetAll}
              />
            )}
          </div>
        </main>

        <footer className="mt-auto flex flex-col items-center gap-2 border-t border-white/5 pt-5 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <AlertTriangle className="h-3 w-3" />
            Files are processed in an ephemeral workspace and deleted automatically within 20 minutes.
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
            Change IT · sharp + pdf-lib · Node.js monolith
          </p>
        </footer>
      </div>
    </div>
  );
}
