"use client";

import {
  canvasToBlob,
  createCanvas,
  getContext,
  loadImage,
  resizeCanvas,
} from "./image";
import {
  addGrain,
  applyJpegArtifacts,
  applyScanQuality,
  blurImageData,
  featherAlpha,
  inkSpread,
} from "./effects";
import { healRegion } from "./inpaint";
import { ensureFont, fitFontSizeToBox, fontCss } from "./fonts";
import { hashString } from "@/lib/utils";
import type {
  BrushBatch,
  BrushStroke,
  Layer,
  Page,
  PatchSettings,
  TextEffects,
  TextLayer,
} from "./types";

export interface PhotoFinish {
  /** 0..1 → baked JPEG artefacts (quality 100 → 30). */
  jpeg: number;
  grain: number;
  softness: number;
  /** 0..1 camera/scan quality loss. */
  scan: number;
}

export const DEFAULT_PHOTO_FINISH: PhotoFinish = {
  jpeg: 0.35,
  grain: 0.12,
  softness: 0.05,
  scan: 0.08,
};

export interface RenderOptions {
  /** Output scale (1 = document pixels). */
  scale?: number;
  /** During dragging we heal with far fewer iterations. */
  draft?: boolean;
  /** Skip healing entirely (used while a text box is being dragged). */
  skipHeal?: boolean;
  /** Applied to the finished composite only (export/preview toggle). */
  finish?: PhotoFinish | null;
  /** Render only text layers (used for the layer thumbnail). */
  textOnly?: boolean;
  /** Layers to leave out of the composite (used while a box is being edited). */
  excludeLayerIds?: string[];
}

interface CacheEntry<T> {
  key: string;
  value: T;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const baseCache = new Map<string, CacheEntry<HTMLCanvasElement>>();

const MAX_BASE_CACHE = 4;

function pageImage(src: string) {
  let cached = imageCache.get(src);
  if (!cached) {
    cached = loadImage(src);
    imageCache.set(src, cached);
    // Bound the cache so long sessions don't hold every page forever.
    if (imageCache.size > 12) {
      const first = imageCache.keys().next().value;
      if (first && first !== src) imageCache.delete(first);
    }
  }
  return cached;
}

export function invalidateBase(pageId: string) {
  baseCache.delete(pageId);
}

export function invalidateAll() {
  baseCache.clear();
  imageCache.clear();
}

function baseCacheKey(page: Page, draft: boolean, skipHeal: boolean) {
  if (skipHeal) return `noh ${page.id} ${page.originalSrc.length}`;
  const patches = page.layers
    .filter((layer) => layer.kind === "cleanup" || (layer.kind === "text" && layer.patch.enabled))
    .map((layer) => {
      const patch = layer.patch;
      return [
        layer.id,
        layer.x,
        layer.y,
        layer.width,
        layer.height,
        layer.rotation,
        patch.mode,
        patch.mask,
        patch.color,
        patch.expand,
        patch.feather,
        patch.textureOffset,
        patch.strength,
      ].join(",");
    })
    .join("|");
  return `${hashString(page.originalSrc.slice(-2048))}|${draft ? "d" : "f"}|${patches}`;
}

/**
 * Full resolution backdrop: the original pixels with every "remove text"
 * patch healed in place, then the manual brush work. Cached per page because
 * healing is the most expensive step in the app.
 */
export async function renderBase(page: Page, options: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const draft = options.draft ?? false;
  const skipHeal = options.skipHeal ?? false;
  const key = baseCacheKey(page, draft, skipHeal);
  const cached = baseCache.get(page.id);
  if (cached && cached.key === key) return cached.value;

  const img = await pageImage(page.originalSrc);
  const canvas = createCanvas(page.width, page.height);
  const ctx = getContext(canvas);
  ctx.drawImage(img, 0, 0, page.width, page.height);

  if (!skipHeal) {
    const patchLayers = page.layers.filter(
      (layer) => layer.kind === "cleanup" || (layer.kind === "text" && layer.patch.enabled),
    );
    for (const layer of patchLayers) {
      applyPatchToCanvas(ctx, page, layer, draft);
    }
  }

  baseCache.set(page.id, { key, value: canvas });
  if (baseCache.size > MAX_BASE_CACHE) {
    const first = baseCache.keys().next().value;
    if (first && first !== page.id) baseCache.delete(first);
  }
  return canvas;
}

function applyPatchToCanvas(
  ctx: CanvasRenderingContext2D,
  page: Page,
  layer: Layer,
  draft: boolean,
) {
  const patch: PatchSettings = layer.patch;
  if (!patch.enabled || patch.mode === "none") return;

  const pad = Math.round(patch.expand + patch.feather + 6);
  const x = Math.max(0, Math.floor(layer.x) - pad);
  const y = Math.max(0, Math.floor(layer.y) - pad);
  const width = Math.min(page.width - x, Math.ceil(layer.width) + pad * 2);
  const height = Math.min(page.height - y, Math.ceil(layer.height) + pad * 2);
  if (width <= 2 || height <= 2) return;

  const image = ctx.getImageData(x, y, width, height);
  const core = {
    x: pad,
    y: pad,
    width: Math.max(1, Math.min(width - pad, Math.ceil(layer.width) + Math.round(patch.expand) * 2)),
    height: Math.max(1, Math.min(height - pad, Math.ceil(layer.height) + Math.round(patch.expand) * 2)),
  };

  const result = healRegion(image, core, {
    mode: patch.mode,
    mask: patch.mask,
    color: patch.color,
    feather: draft ? Math.max(1, patch.feather * 0.7) : patch.feather,
    expand: patch.expand,
    textureOffset: patch.textureOffset,
    strength: draft ? Math.min(0.5, patch.strength) : patch.strength,
    iterations: draft ? 26 : undefined,
  });

  // Only write the core area back; the halo was untouched source material.
  ctx.putImageData(
    result.region,
    x,
    y,
    0,
    0,
    Math.min(result.region.width, core.width + pad),
    Math.min(result.region.height, core.height + pad),
  );
}

/** Manual brush strokes: clone / colour / blur, applied over the backdrop. */
export function drawBrushBatches(
  canvas: HTMLCanvasElement,
  page: Page,
  batches: BrushBatch[],
  scale: number,
) {
  const ctx = getContext(canvas);
  for (const batch of batches) {
    for (const stroke of batch.strokes) {
      drawStroke(ctx, canvas, page, stroke, scale);
    }
  }
}

function tracePath(ctx: CanvasRenderingContext2D, stroke: BrushStroke, scale: number) {
  const pts = stroke.points;
  if (pts.length < 2) return false;
  ctx.beginPath();
  ctx.moveTo(pts[0] * scale, pts[1] * scale);
  for (let i = 2; i < pts.length; i += 2) {
    ctx.lineTo(pts[i] * scale, pts[i + 1] * scale);
  }
  if (pts.length === 2) ctx.lineTo(pts[0] * scale + 0.01, pts[1] * scale + 0.01);
  return true;
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  page: Page,
  stroke: BrushStroke,
  scale: number,
) {
  if (stroke.points.length < 2) return;
  const width = Math.max(1, stroke.size * scale);
  const passes = stroke.hardness >= 0.92 ? 1 : 3;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 1;

  for (let pass = 0; pass < passes; pass++) {
    // Outer passes are wider and fainter → soft brush edge.
    const t = passes === 1 ? 0 : pass / (passes - 1);
    const passWidth = width * (1 + (1 - stroke.hardness) * 0.9 * (1 - t));
    const passAlpha = passes === 1 ? 1 : t === 0 ? 0.22 : t === 1 ? 0.92 : 0.5;
    ctx.lineWidth = passWidth;
    ctx.globalAlpha = passAlpha;

    if (!tracePath(ctx, stroke, scale)) break;

    if (stroke.mode === "clone") {
      ctx.save();
      ctx.clip();
      const dx = stroke.offsetX * scale;
      const dy = stroke.offsetY * scale;
      ctx.globalAlpha = passAlpha;
      ctx.drawImage(canvas, -dx, -dy);
      ctx.restore();
    } else if (stroke.mode === "blur") {
      ctx.save();
      ctx.clip();
      const blurred = createCanvas(canvas.width, canvas.height);
      const bctx = getContext(blurred);
      const radius = Math.max(1, stroke.blur * scale);
      if (typeof bctx.filter === "string") {
        bctx.filter = `blur(${radius}px)`;
        bctx.drawImage(canvas, 0, 0);
      } else {
        bctx.drawImage(canvas, 0, 0);
        const data = bctx.getImageData(0, 0, blurred.width, blurred.height);
        blurImageData(data.data, data.width, data.height, radius);
        bctx.putImageData(data, 0, 0);
      }
      ctx.globalAlpha = passAlpha;
      ctx.drawImage(blurred, 0, 0);
      ctx.restore();
      void page;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Break text into wrapped lines that fit the layer width. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split("\n");
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

function measureLine(ctx: CanvasRenderingContext2D, line: string, spacing: number) {
  return ctx.measureText(line).width + spacing * Math.max(0, line.length - 1);
}

/** Draw one line, optionally with per-glyph alpha jitter (uneven toner). */
function paintLine(
  ctx: CanvasRenderingContext2D,
  options: {
    line: string;
    x: number;
    baseline: number;
    letterSpacing: number;
    color: string;
    opacity: number;
    jitter: number;
    seed: number;
  },
) {
  const { line, x, baseline, letterSpacing, color, opacity, jitter } = options;
  ctx.fillStyle = color;
  if (jitter <= 0.02) {
    ctx.globalAlpha = opacity;
    if (letterSpacing !== 0 && "letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
    }
    ctx.fillText(line, x, baseline, options.line.length ? undefined : undefined);
    if (letterSpacing !== 0 && "letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    }
    return;
  }

  let cursor = x;
  let seed = options.seed || 1;
  for (const char of line) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const rand = (seed % 1000) / 1000;
    const alpha = Math.max(0.35, 1 - jitter * rand - jitter * 0.25);
    ctx.globalAlpha = opacity * alpha;
    ctx.fillText(char, cursor, baseline);
    cursor += ctx.measureText(char).width + letterSpacing;
  }
  ctx.globalAlpha = opacity;
}

/**
 * Paint a text layer on its own transparent bitmap (so per-layer effects like
 * softness, grain and JPEG ringing never touch the background), then place it
 * on the composite with rotation.
 */
async function paintTextLayer(layer: TextLayer, scale: number): Promise<HTMLCanvasElement> {
  await ensureFont(layer.fontFamily, layer.fontWeight, layer.italic);

  const effects = layer.effects;
  const pad = Math.ceil(6 + effects.softness * 14 + effects.inkSpread * 6);
  const width = Math.max(4, Math.round(layer.width * scale)) + pad * 2;
  const height = Math.max(4, Math.round(layer.height * scale)) + pad * 2;
  const canvas = createCanvas(width, height);
  const ctx = getContext(canvas);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const boxWidth = Math.max(2, layer.width * scale);
  const boxHeight = Math.max(2, layer.height * scale);

  let fontSize = layer.fontSize * scale;
  if (layer.autoFit) {
    fontSize = fitFontSizeToBox(ctx, {
      text: layer.text,
      box: { width: boxWidth * 0.995, height: boxHeight * 0.995 },
      fontFamily: layer.fontFamily,
      fontWeight: layer.fontWeight,
      italic: layer.italic,
      letterSpacing: layer.letterSpacing,
      max: Math.max(boxHeight * 1.6, 24),
    });
  }

  ctx.font = fontCss(layer, { size: fontSize });
  const spacing = layer.letterSpacing * fontSize;
  const lines = wrapText(ctx, layer.text, Math.max(4, boxWidth));
  const lineHeight = fontSize * layer.lineHeight;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = pad + Math.max(fontSize * 0.82, (boxHeight - blockHeight) / 2 + fontSize * 0.82);

  const metrics = ctx.measureText("Hx");
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.25;

  lines.forEach((line, index) => {
    const lineWidth = measureLine(ctx, line, spacing);
    let x = pad;
    if (layer.align === "center") x = pad + (boxWidth - lineWidth) / 2;
    if (layer.align === "right") x = pad + (boxWidth - lineWidth);
    const baseline = firstBaseline + index * lineHeight;
    paintLine(ctx, {
      line,
      x,
      baseline,
      letterSpacing: spacing,
      color: layer.color,
      opacity: layer.opacity,
      jitter: effects.opacityJitter,
      seed: hashString(layer.id).length + index * 977 + 7,
    });

    if (layer.underline) {
      const thickness = Math.max(1, fontSize * 0.07);
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = layer.color;
      ctx.fillRect(x, baseline + descent * 0.35, lineWidth, thickness);
    }
  });

  // --- per layer realism passes -------------------------------------------------
  if (effects.inkSpread > 0.005 || effects.blendEdges > 0.005 || effects.softness > 0.005 || effects.grain > 0.005 || effects.jpeg > 0.005) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (effects.inkSpread > 0.005) inkSpread(data.data, data.width, data.height, effects.inkSpread);
    if (effects.blendEdges > 0.005) featherAlpha(data.data, data.width, data.height, effects.blendEdges);
    if (effects.softness > 0.005) blurImageData(data.data, data.width, data.height, effects.softness * 1.6);
    if (effects.grain > 0.005) addGrain(data.data, data.width, data.height, effects.grain, 17 + layer.id.length);
    if (effects.jpeg > 0.005) {
      applyJpegArtifacts(data, Math.max(12, 100 - effects.jpeg * 78), { chromaSubsample: effects.jpeg > 0.5 });
    }
    ctx.putImageData(data, 0, 0);
  }

  return canvas;
}

export async function drawTextLayers(
  canvas: HTMLCanvasElement,
  layers: TextLayer[],
  scale: number,
) {
  const ctx = getContext(canvas);
  for (const layer of layers) {
    if (!layer.visible || !layer.text.trim()) continue;
    const bitmap = await paintTextLayer(layer, scale);
    const pad = (bitmap.width - Math.round(layer.width * scale)) / 2;
    ctx.save();
    ctx.translate((layer.x + layer.width / 2) * scale, (layer.y + layer.height / 2) * scale);
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    void pad;
    ctx.restore();
  }
}

/** Apply the global photographic finish to a finished composite. */
export function applyFinish(canvas: HTMLCanvasElement, finish: PhotoFinish) {
  if (!finish) return;
  const ctx = getContext(canvas);
  const needsPixels =
    finish.jpeg > 0.005 || finish.grain > 0.005 || finish.softness > 0.005 || finish.scan > 0.005;
  if (!needsPixels) return;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (finish.scan > 0.005) applyScanQuality(data, finish.scan);
  if (finish.softness > 0.005) blurImageData(data.data, data.width, data.height, finish.softness * 1.4);
  if (finish.grain > 0.005) addGrain(data.data, data.width, data.height, finish.grain, 4242);
  if (finish.jpeg > 0.005) applyJpegArtifacts(data, Math.max(15, 100 - finish.jpeg * 80));
  ctx.putImageData(data, 0, 0);
}

export interface ComposeResult {
  canvas: HTMLCanvasElement;
  durationMs: number;
}

/**
 * The main entry point: original → healed background → brush work → text
 * layers → optional photographic finish. Everything the UI shows comes from
 * here, so preview and export can never drift apart.
 */
export async function composePage(page: Page, options: RenderOptions = {}): Promise<ComposeResult> {
  const started = performance.now();
  const scale = options.scale ?? 1;
  const base = await renderBase(page, options);

  let canvas: HTMLCanvasElement;
  if (scale === 1) {
    canvas = createCanvas(page.width, page.height);
    getContext(canvas).drawImage(base, 0, 0);
  } else {
    canvas = resizeCanvas(base, Math.max(1, Math.round(page.width * scale)), Math.max(1, Math.round(page.height * scale)));
  }

  drawBrushBatches(canvas, page, page.brushBatches, scale);

  const excluded = options.excludeLayerIds ?? [];
  const textLayers = page.layers.filter(
    (layer): layer is TextLayer =>
      layer.kind === "text" && layer.visible && !excluded.includes(layer.id),
  );
  if (textLayers.length) await drawTextLayers(canvas, textLayers, scale);

  if (options.finish) applyFinish(canvas, options.finish);

  return { canvas, durationMs: performance.now() - started };
}

export async function composeToBlob(
  page: Page,
  options: RenderOptions & { type?: string; quality?: number } = {},
): Promise<Blob> {
  const { canvas } = await composePage(page, options);
  return canvasToBlob(canvas, options.type ?? "image/png", options.quality ?? 0.95);
}

/** Small thumbnail for the page rail. */
export async function renderThumbnail(page: Page, maxSize = 144): Promise<string> {
  const scale = Math.min(1, maxSize / Math.max(page.width, page.height));
  const { canvas } = await composePage(page, { scale, draft: true });
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function totalPatchCount(page: Page) {
  return page.layers.filter((l) => l.kind === "cleanup" || (l.kind === "text" && l.patch.enabled)).length;
}

export type { TextEffects };
