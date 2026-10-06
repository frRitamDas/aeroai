"use client";

import { createCanvas, fileToImage, getContext, imageToCanvas, resizeCanvas } from "./image";
import { uid } from "@/lib/utils";
import type { Page } from "./types";

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
  "image/gif",
  "image/avif",
];

export const MAX_INPUT_PIXELS = 24_000_000; // ~24MP guard so the tab stays responsive
export const MAX_PDF_PAGE_DIMENSION = 2400;

export interface ImportResult {
  pages: Page[];
  warnings: string[];
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function isSupportedImage(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(file.name);
}

async function pageFromImage(file: File): Promise<Page> {
  const img = await fileToImage(file);
  let canvas = imageToCanvas(img);
  if (canvas.width * canvas.height > MAX_INPUT_PIXELS) {
    const scale = Math.sqrt(MAX_INPUT_PIXELS / (canvas.width * canvas.height));
    canvas = resizeCanvas(canvas, Math.round(canvas.width * scale), Math.round(canvas.height * scale));
  }
  return {
    id: uid("page"),
    kind: "image",
    name: file.name,
    width: canvas.width,
    height: canvas.height,
    originalSrc: canvas.toDataURL("image/png"),
    layers: [],
    brushBatches: [],
  };
}

/**
 * PDF import via pdf.js. Pages are rasterised (max 2400px on the long edge by
 * default) so that every editor feature — healing, OCR, brush work — behaves
 * exactly like it does on a photo.
 */
export async function pagesFromPdf(
  file: File,
  options: { maxPages?: number; dimension?: number } = {},
): Promise<Page[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = await resolvePdfWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const count = options.maxPages ? Math.min(doc.numPages, options.maxPages) : doc.numPages;
  const limit = options.dimension ?? MAX_PDF_PAGE_DIMENSION;
  const pages: Page[] = [];

  for (let index = 1; index <= count; index++) {
    const pdfPage = await doc.getPage(index);
    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(3, limit / Math.max(baseViewport.width, baseViewport.height));
    const viewport = pdfPage.getViewport({ scale: Math.max(1, scale) });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = getContext(canvas);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
    pages.push({
      id: uid("page"),
      kind: "pdf",
      name: `${file.name} · p${index}`,
      width: canvas.width,
      height: canvas.height,
      originalSrc: canvas.toDataURL("image/png"),
      pdfPage: index,
      pdfPageCount: doc.numPages,
      layers: [],
      brushBatches: [],
    });
  }
  return pages;
}

let cachedPdfWorker: string | null = null;
let resolvingWorker: Promise<string> | null = null;

/**
 * The pdf.js worker is copied into /public at install time. If that file is
 * missing (e.g. a stripped deployment) we fall back to the matching CDN build
 * so imports never hard-fail.
 */
async function resolvePdfWorker(): Promise<string> {
  if (cachedPdfWorker) return cachedPdfWorker;
  if (resolvingWorker) return resolvingWorker;
  resolvingWorker = (async () => {
    const local = "/pdf.worker.min.mjs";
    try {
      const head = await fetch(local, { method: "HEAD" });
      if (head.ok) {
        cachedPdfWorker = local;
        return local;
      }
    } catch {
      // fall through to CDN
    }
    const pdfjs = await import("pdfjs-dist");
    const version = pdfjs.version ?? "6.4.299";
    cachedPdfWorker = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    return cachedPdfWorker;
  })();
  return resolvingWorker;
}

export async function importFiles(
  files: File[],
  options: { maxPdfPages?: number; onProgress?: (message: string, progress: number) => void } = {},
): Promise<ImportResult> {
  const pages: Page[] = [];
  const warnings: string[] = [];
  const progress = options.onProgress ?? (() => {});

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const base = index / files.length;
    const weight = 1 / files.length;
    if (isPdf(file)) {
      progress(`Rendering ${file.name}…`, base);
      try {
        const pdfPages = await pagesFromPdf(file, { maxPages: options.maxPdfPages });
        pages.push(...pdfPages);
      } catch (error) {
        warnings.push(`${file.name}: ${(error as Error).message}`);
      }
    } else if (isSupportedImage(file)) {
      progress(`Opening ${file.name}…`, base);
      try {
        pages.push(await pageFromImage(file));
      } catch (error) {
        warnings.push(`${file.name}: ${(error as Error).message}`);
      }
    } else {
      warnings.push(`${file.name}: unsupported file type.`);
    }
    progress(file.name, base + weight);
  }

  return { pages, warnings };
}

/** Persist a page's edited pixels as a fresh page (used by "duplicate"). */
export function duplicatePage(page: Page, copySuffix = "copy"): Page {
  return {
    ...page,
    id: uid("page"),
    name: `${page.name} (${copySuffix})`,
    layers: page.layers.map((layer) => ({ ...layer, id: uid(layer.kind) })),
    brushBatches: page.brushBatches.map((batch) => ({
      id: uid("batch"),
      revision: batch.revision,
      strokes: batch.strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] })),
    })),
  };
}
