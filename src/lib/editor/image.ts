"use client";

/**
 * Small DOM/canvas helpers shared by the editor. Everything here is
 * browser-only and intentionally dependency free.
 */

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function getContext(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true, ...options });
  if (!ctx) throw new Error("Canvas 2D context unavailable in this browser.");
  return ctx;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to decode image."));
    img.src = src;
  });
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function imageToCanvas(
  source: CanvasImageSource & { width?: number; height?: number },
  width?: number,
  height?: number,
): HTMLCanvasElement {
  const w = width ?? (source as HTMLImageElement).naturalWidth ?? (source as HTMLCanvasElement).width;
  const h = height ?? (source as HTMLImageElement).naturalHeight ?? (source as HTMLCanvasElement).height;
  const canvas = createCanvas(w, h);
  const ctx = getContext(canvas);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvas(source.width, source.height);
  getContext(canvas).drawImage(source, 0, 0);
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed."))),
      type,
      quality,
    );
  });
}

export function canvasToObjectUrl(canvas: HTMLCanvasElement, quality = 0.92): Promise<string> {
  return canvasToBlob(canvas, "image/jpeg", quality).then((blob) => URL.createObjectURL(blob));
}

export function getRegionImageData(
  source: HTMLCanvasElement | ImageData,
  rect: { x: number; y: number; width: number; height: number },
): ImageData {
  if (source instanceof ImageData) {
    const out = new ImageData(rect.width, rect.height);
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const srcIndex = ((rect.y + y) * source.width + (rect.x + x)) * 4;
        const dstIndex = (y * rect.width + x) * 4;
        out.data[dstIndex] = source.data[srcIndex];
        out.data[dstIndex + 1] = source.data[srcIndex + 1];
        out.data[dstIndex + 2] = source.data[srcIndex + 2];
        out.data[dstIndex + 3] = source.data[srcIndex + 3];
      }
    }
    return out;
  }
  return getContext(source).getImageData(rect.x, rect.y, rect.width, rect.height);
}

export function putRegionImageData(
  target: HTMLCanvasElement,
  imageData: ImageData,
  x: number,
  y: number,
) {
  getContext(target).putImageData(imageData, x, y);
}

/** Draw an ImageData onto a canvas honouring its own alpha (putImageData replaces it). */
export function drawImageData(
  target: HTMLCanvasElement,
  imageData: ImageData,
  x: number,
  y: number,
) {
  const tmp = createCanvas(imageData.width, imageData.height);
  getContext(tmp).putImageData(imageData, 0, 0);
  getContext(target).drawImage(tmp, x, y);
}

export function supportsCanvasFilter(): boolean {
  if (typeof document === "undefined") return false;
  const ctx = getContext(createCanvas(1, 1));
  return typeof ctx.filter === "string";
}

export function downscaleToFit(
  source: HTMLCanvasElement,
  maxDimension: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
  if (scale >= 1) return source;
  const canvas = createCanvas(source.width * scale, source.height * scale);
  const ctx = getContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * High quality resize of a canvas using stepwise downscaling (avoids the
 * aliasing the browser's single-step resize produces on big downscales).
 */
export function resizeCanvas(source: HTMLCanvasElement, width: number, height: number) {
  let current = source;
  let currentW = source.width;
  let currentH = source.height;
  while (currentW / 2 > width && currentH / 2 > height) {
    const nextW = Math.max(1, Math.floor(currentW / 2));
    const nextH = Math.max(1, Math.floor(currentH / 2));
    const step = createCanvas(nextW, nextH);
    const ctx = getContext(step);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, nextW, nextH);
    current = step;
    currentW = nextW;
    currentH = nextH;
  }
  const out = createCanvas(width, height);
  const ctx = getContext(out);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, width, height);
  return out;
}

/** Sample a single pixel colour (ignores alpha). */
export function samplePixel(canvas: HTMLCanvasElement, x: number, y: number): string {
  const ctx = getContext(canvas);
  const size = 3;
  const rect = {
    x: Math.max(0, Math.min(canvas.width - size, Math.round(x - size / 2))),
    y: Math.max(0, Math.min(canvas.height - size, Math.round(y - size / 2))),
  };
  const data = ctx.getImageData(rect.x, rect.y, size, size).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (!n) return "#ffffff";
  const to = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function dataUrlToCanvas(src: string): Promise<HTMLCanvasElement> {
  return loadImage(src).then((img) => imageToCanvas(img));
}
