import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
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

const PAGE_SIZES: Record<Exclude<PageFit, 'original'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const PDF_MAX_PAGE_POINTS = 14400;

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
      const rawWidth = (image.width * 72) / 96;
      const rawHeight = (image.height * 72) / 96;
      const clamp = Math.min(1, PDF_MAX_PAGE_POINTS / Math.max(rawWidth, rawHeight));
      const pageWidth = Math.max(1, rawWidth * clamp);
      const pageHeight = Math.max(1, rawHeight * clamp);
      const page = doc.addPage([pageWidth, pageHeight]);
      page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      continue;
    }

    const [pageWidth, pageHeight] = PAGE_SIZES[fit];
    const margin = 24;
    const scale = Math.min(
      (pageWidth - margin * 2) / image.width,
      (pageHeight - margin * 2) / image.height,
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

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

let pdfjsPromise: Promise<any> | null = null;
let standardFontDataUrl: string | undefined;

function resolveStandardFonts(): string | undefined {
  if (standardFontDataUrl !== undefined) return standardFontDataUrl;
  try {
    const req = createRequire(import.meta.url);
    let packageRoot: string | null = null;
    try {
      packageRoot = path.dirname(req.resolve('pdfjs-dist/package.json'));
    } catch {
      try {
        const entry = req.resolve('pdfjs-dist');
        packageRoot = path.dirname(path.dirname(entry));
      } catch {
        packageRoot = null;
      }
    }

    if (packageRoot) {
      const fontsDir = path.join(packageRoot, 'standard_fonts');
      if (existsSync(fontsDir)) {
        standardFontDataUrl = pathToFileURL(`${fontsDir}${path.sep}`).href;
      }
    }
  } catch {
    standardFontDataUrl = undefined;
  }
  return standardFontDataUrl;
}

async function loadPdfjs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = (async () => {
    Object.assign(globalThis, {
      DOMMatrix: NapiDOMMatrix,
      ImageData: NapiImageData,
      Path2D: NapiPath2D,
    });

    const candidates = [
      'pdfjs-dist/legacy/build/pdf.mjs',
      'pdfjs-dist/build/pdf.mjs',
    ];

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        return await import(candidate);
      } catch (error) {
        lastError = error;
      }
    }

    try {
      const req = createRequire(import.meta.url);
      const resolved = req.resolve('pdfjs-dist/legacy/build/pdf.mjs');
      return await import(pathToFileURL(resolved).href);
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

export async function* renderPdfPages(
  data: Buffer,
  options: PdfRenderOptions,
): AsyncGenerator<RenderedPdfPage> {
  const pdfjs = await loadPdfjs();
  const fonts = resolveStandardFonts();

  let doc: any;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      ...(fonts ? { standardFontDataUrl: fonts } : {}),
    });
    doc = await loadingTask.promise;
  } catch (error) {
    throw new ApiError(
      422,
      'INVALID_PDF',
      'This PDF could not be opened. It may be corrupted or password-protected.',
      { cause: error },
    );
  }

  const totalPages: number = doc.numPages;
  const pageLimit = Math.min(totalPages, options.maxPages);

  try {
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      try {
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

        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        const png = canvas.toBuffer('image/png');
        yield { pageNumber, totalPages, png, width, height };
      } finally {
        await page.cleanup();
      }
    }
  } finally {
    try {
      await doc.destroy();
    } catch {
      void 0;
    }
  }
}
