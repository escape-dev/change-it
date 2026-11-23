import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PDFDocument, type PDFImage } from 'pdf-lib';
import {
  createCanvas,
  DOMMatrix as NapiDOMMatrix,
  ImageData as NapiImageData,
  Path2D as NapiPath2D,
} from '@napi-rs/canvas';
import { ApiError } from '../utils/errors.js';
import type { PageFit } from '../utils/formats.js';

export interface PdfImageInput {
  data: Buffer;
  width: number;
  height: number;
}

export interface RenderedPdfPage {
  pageNumber: number;
  totalPages: number;
  png: Buffer;
  width: number;
  height: number;
}

export interface PdfRenderOptions {
  maxPages: number;
  dpi: number;
  maxEdge: number;
}

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfPage {
  getViewport(params: { scale: number }): PdfViewport;
  render(params: {
    canvasContext: unknown;
    viewport: PdfViewport;
    canvas: unknown;
  }): { promise: Promise<void> };
  cleanup(): Promise<void>;
}

interface PdfDocumentView {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

interface PdfJsModule {
  getDocument(options: Record<string, unknown>): { promise: Promise<PdfDocumentView> };
}

const PAGE_SIZES: Record<Exclude<PageFit, 'original'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const PAGE_MARGIN = 24;
const PDF_MAX_PAGE_POINTS = 14_400;
const PIXELS_PER_INCH = 96;

function addOriginalSizePage(
  doc: PDFDocument,
  image: PdfImageInput,
  embedded: PDFImage,
): void {
  const rawWidth = (image.width * 72) / PIXELS_PER_INCH;
  const rawHeight = (image.height * 72) / PIXELS_PER_INCH;
  const scale = Math.min(1, PDF_MAX_PAGE_POINTS / Math.max(rawWidth, rawHeight));
  const pageWidth = Math.max(1, rawWidth * scale);
  const pageHeight = Math.max(1, rawHeight * scale);

  const page = doc.addPage([pageWidth, pageHeight]);
  page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
}

function addFittedPage(
  doc: PDFDocument,
  image: PdfImageInput,
  embedded: PDFImage,
  fit: Exclude<PageFit, 'original'>,
): void {
  const [pageWidth, pageHeight] = PAGE_SIZES[fit];
  const scale = Math.min(
    (pageWidth - PAGE_MARGIN * 2) / image.width,
    (pageHeight - PAGE_MARGIN * 2) / image.height,
  );
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  const page = doc.addPage([pageWidth, pageHeight]);
  page.drawImage(embedded, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

export async function buildPdfFromImages(images: PdfImageInput[], fit: PageFit): Promise<Buffer> {
  if (images.length === 0) {
    throw new ApiError(400, 'NO_IMAGES', 'Add at least one image to build a PDF.');
  }

  const doc = await PDFDocument.create();
  doc.setProducer('Change IT');
  doc.setCreator('Change IT');
  doc.setTitle('Created with Change IT');

  for (const image of images) {
    const embedded = await doc.embedJpg(image.data);

    if (fit === 'original') {
      addOriginalSizePage(doc, image, embedded);
    } else {
      addFittedPage(doc, image, embedded, fit);
    }
  }

  return Buffer.from(await doc.save());
}

let pdfjsPromise: Promise<PdfJsModule> | null = null;
let fontsResolved = false;
let standardFontDataUrl: string | undefined;

function resolvePackageRoot(): string | null {
  const require = createRequire(import.meta.url);

  try {
    return path.dirname(require.resolve('pdfjs-dist/package.json'));
  } catch {
    try {
      const entry = require.resolve('pdfjs-dist');
      return path.dirname(path.dirname(entry));
    } catch {
      return null;
    }
  }
}

function getStandardFontDataUrl(): string | undefined {
  if (fontsResolved) return standardFontDataUrl;
  fontsResolved = true;

  const packageRoot = resolvePackageRoot();
  if (!packageRoot) return undefined;

  const fontsDir = path.join(packageRoot, 'standard_fonts');
  if (existsSync(fontsDir)) {
    standardFontDataUrl = pathToFileURL(`${fontsDir}${path.sep}`).href;
  }

  return standardFontDataUrl;
}

async function loadPdfjs(): Promise<PdfJsModule> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = (async () => {
    Object.assign(globalThis, {
      DOMMatrix: NapiDOMMatrix,
      ImageData: NapiImageData,
      Path2D: NapiPath2D,
    });

    const candidates = ['pdfjs-dist/legacy/build/pdf.mjs', 'pdfjs-dist/build/pdf.mjs'];
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        return (await import(candidate)) as PdfJsModule;
      } catch (error) {
        lastError = error;
      }
    }

    try {
      const require = createRequire(import.meta.url);
      const resolved = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
      return (await import(pathToFileURL(resolved).href)) as PdfJsModule;
    } catch (error) {
      lastError = error;
    }

    throw new ApiError(
      500,
      'PDF_ENGINE_UNAVAILABLE',
      'The PDF rendering engine could not be loaded in this environment.',
      { cause: lastError },
    );
  })();

  return pdfjsPromise;
}

async function openPdf(data: Buffer): Promise<PdfDocumentView> {
  const pdfjs = await loadPdfjs();
  const fonts = getStandardFontDataUrl();

  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      ...(fonts ? { standardFontDataUrl: fonts } : {}),
    });

    return await loadingTask.promise;
  } catch (error) {
    throw new ApiError(
      422,
      'INVALID_PDF',
      'This PDF could not be opened. It may be corrupted or password-protected.',
      { cause: error },
    );
  }
}

async function renderPage(
  page: PdfPage,
  options: PdfRenderOptions,
): Promise<{ png: Buffer; width: number; height: number }> {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    options.dpi / 72,
    options.maxEdge / Math.max(baseViewport.width, baseViewport.height),
  );
  const viewport = page.getViewport({ scale: Math.max(scale, 0.05) });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  await page.render({ canvasContext: context, viewport, canvas }).promise;

  return { png: canvas.toBuffer('image/png'), width, height };
}

async function closePdf(doc: PdfDocumentView): Promise<void> {
  await doc.destroy().catch(() => undefined);
}

export async function* renderPdfPages(
  data: Buffer,
  options: PdfRenderOptions,
): AsyncGenerator<RenderedPdfPage> {
  const doc = await openPdf(data);
  const pageLimit = Math.min(doc.numPages, options.maxPages);

  try {
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);

      try {
        const rendered = await renderPage(page, options);
        yield {
          pageNumber,
          totalPages: doc.numPages,
          ...rendered,
        };
      } finally {
        await page.cleanup();
      }
    }
  } finally {
    await closePdf(doc);
  }
}
