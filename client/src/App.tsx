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
import { useConversion } from './hooks/useConversion';
import { formatBytes } from './lib/format';
import type { PageFit } from './types';

export default function App() {
  const queue = useFileQueue();
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [pageFit, setPageFit] = useState<PageFit>('original');
  const resultsRef = useRef<HTMLDivElement>(null);

  const conversion = useConversion({
    files: queue.files,
    globalTarget: queue.globalTarget,
    globalCompression: queue.globalCompression,
    pageFit,
    resizeEnabled,
    resizeWidth,
    resizeHeight,
  });

  useClipboardPaste(queue.addFiles, !conversion.isConverting);

  const isConverting = conversion.isConverting;
  const showPageFit = queue.files.some((item) => item.targetFormat === 'pdf');
  const pdfGroupCount = queue.files.filter((item) => item.targetFormat === 'pdf').length;

  const handleConvert = async () => {
    const result = await conversion.convert();
    if (!result) return;

    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleResetAll = () => {
    queue.clearFiles();
    conversion.reset();
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
                <Notice
                  tone="warning"
                  title="Some files were skipped"
                  onDismiss={() => queue.setError(null)}
                >
                  {queue.error}
                </Notice>
              )}

              {conversion.requestError && (
                <Notice
                  tone="error"
                  title="Could not convert"
                  onDismiss={conversion.dismissError}
                >
                  <p>{conversion.requestError}</p>
                  {!conversion.response && conversion.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {conversion.errors.map((item, index) => (
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
            {conversion.response && (
              <ResultsView
                jobId={conversion.response.jobId}
                results={conversion.response.results}
                errors={conversion.errors}
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
