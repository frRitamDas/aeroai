"use client";

import { canvasToBlob, createCanvas, getContext } from "./image";
import { applyFinish, composePage, type PhotoFinish } from "./render";
import type { ExportSettings, Page } from "./types";

export interface ExportProgress {
  index: number;
  total: number;
  label: string;
}

export interface ExportOptions {
  settings: ExportSettings;
  finish?: PhotoFinish | null;
  onProgress?: (progress: ExportProgress) => void;
}

const MIME: Record<ExportSettings["format"], string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

function safeName(name: string) {
  return (name || "aerotext-edit").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
}

export interface ExportedFile {
  filename: string;
  blob: Blob;
  width: number;
  height: number;
}

/** Render every requested page at the requested scale. */
export async function renderForExport(
  pages: Page[],
  options: ExportOptions,
): Promise<ExportedFile[]> {
  const { settings, finish } = options;
  const scale = Math.max(0.1, Math.min(4, settings.scale || 1));
  const out: ExportedFile[] = [];
  const total = pages.length || 1;

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    options.onProgress?.({ index: index + 1, total, label: `Rendering ${page.name}` });
    const { canvas } = await composePage(page, { scale, finish: null });
    if (finish) applyFinish(canvas, finish);

    const blob =
      settings.format === "pdf"
        ? await canvasToBlob(canvas, "image/png")
        : await canvasToBlob(canvas, MIME[settings.format], settings.quality);

    out.push({
      filename:
        pages.length > 1
          ? `${safeName(settings.filename)}-p${index + 1}.${settings.format}`
          : `${safeName(settings.filename)}.${settings.format}`,
      blob,
      width: canvas.width,
      height: canvas.height,
    });
  }
  return out;
}

/** Multi page PDF export through jsPDF (lazy loaded — it is a big dependency). */
export async function buildPdf(files: ExportedFile[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const first = files[0];
  if (!first) throw new Error("Nothing to export.");
  const doc = new jsPDF({
    unit: "px",
    format: [first.width, first.height],
    orientation: first.width >= first.height ? "landscape" : "portrait",
    compress: true,
  });

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (index > 0) doc.addPage([file.width, file.height], file.width >= file.height ? "landscape" : "portrait");
    const dataUrl = await blobToDataUrl(file.blob);
    const format = file.blob.type === "image/jpeg" ? "JPEG" : "PNG";
    doc.addImage(dataUrl, format, 0, 0, file.width, file.height, undefined, "FAST");
  }
  return doc.output("blob");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image data."));
    reader.readAsDataURL(blob);
  });
}

export async function exportPages(pages: Page[], options: ExportOptions): Promise<ExportedFile[]> {
  const files = await renderForExport(pages, options);
  if (options.settings.format !== "pdf") return files;
  const merged = await buildPdf(files);
  return [
    {
      filename: `${safeName(options.settings.filename)}.pdf`,
      blob: merged,
      width: files[0].width,
      height: files[0].height,
    },
  ];
}

/** Copy the rendered page straight to the clipboard (PNG). */
export async function copyPageToClipboard(page: Page, finish?: PhotoFinish | null) {
  const { canvas } = await composePage(page, { finish: null });
  if (finish) applyFinish(canvas, finish);
  const blob = await canvasToBlob(canvas, "image/png");
  const ClipboardItemCtor = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (!navigator.clipboard || !ClipboardItemCtor) {
    throw new Error("Clipboard images are not supported in this browser.");
  }
  await navigator.clipboard.write([new ClipboardItemCtor({ "image/png": blob })]);
  return blob;
}

/** Flatten a page to a single canvas (used for thumbnails and sharing). */
export async function flattenPage(page: Page, finish?: PhotoFinish | null) {
  const { canvas } = await composePage(page, { finish: null });
  if (finish) applyFinish(canvas, finish);
  return canvas;
}

export function estimateOutputSize(page: Page, settings: ExportSettings) {
  const width = Math.round(page.width * settings.scale);
  const height = Math.round(page.height * settings.scale);
  const pixels = width * height;
  const bytesPerPixel =
    settings.format === "png" ? 1.6 : settings.format === "webp" ? 0.5 : 0.35 * (settings.quality || 0.9) * 2.6;
  return { width, height, bytes: Math.round(pixels * bytesPerPixel) };
}

export { createCanvas, getContext };
