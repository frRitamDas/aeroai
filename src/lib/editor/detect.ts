"use client";

import { getRegionImageData, loadImage, imageToCanvas } from "./image";
import { analyseTextRegion } from "./color";
import { suggestFonts } from "./fonts";
import { groupWordsIntoLines, type GroupMode, type OcrProgress } from "./ocr";
import { clampRect } from "./geometry";
import { uid } from "@/lib/utils";
import { DEFAULT_EFFECTS, DEFAULT_PATCH, type OcrLine, type TextLayer } from "./types";

export interface DetectOptions {
  /** Source pixels used for colour/structure sampling (document resolution). */
  base: HTMLCanvasElement;
  group?: GroupMode;
  minConfidence?: number;
  /** Padding added around each detected box, as a fraction of line height. */
  padding?: number;
}

export interface DetectResult {
  layers: TextLayer[];
  /** Lines dropped because of low confidence. */
  skipped: number;
}

export interface DetectProgress {
  index: number;
  total: number;
  label: string;
}

/** Merge OCR lines into paragraph-level boxes (used by the "block" group mode). */
export function mergeLinesIntoBlocks(lines: OcrLine[]): OcrLine[] {
  if (!lines.length) return [];
  const sorted = [...lines].sort((a, b) => a.y - b.y);
  const blocks: OcrLine[][] = [];
  for (const line of sorted) {
    const target = blocks.find((block) => {
      const last = block[block.length - 1];
      const gap = line.y - (last.y + last.height);
      const sameColumn = Math.abs(line.x - last.x) < Math.max(last.height, line.height) * 1.4;
      const lastIsShort = /[.;:!?]$/.test(last.text) === false;
      return gap < last.height * 0.85 && sameColumn && lastIsShort;
    });
    if (target) target.push(line);
    else blocks.push([line]);
  }
  return blocks.map((block) => {
    const x = Math.min(...block.map((line) => line.x));
    const y = Math.min(...block.map((line) => line.y));
    const right = Math.max(...block.map((line) => line.x + line.width));
    const bottom = Math.max(...block.map((line) => line.y + line.height));
    return {
      text: block.map((line) => line.text).join("\n"),
      confidence: block.reduce((sum, line) => sum + line.confidence, 0) / block.length,
      x,
      y,
      width: right - x,
      height: bottom - y,
      words: block.flatMap((line) => line.words),
    };
  });
}

/**
 * Turn raw OCR lines into ready-to-edit text layers: every box gets its
 * original colour, background colour, font traits and a heal strategy.
 */
export function buildTextLayers(
  lines: OcrLine[],
  options: DetectOptions & { onProgress?: (progress: DetectProgress) => void },
): DetectResult {
  const { base, minConfidence = 45, padding = 0.14, group = "line" } = options;
  const grouped =
    group === "block" ? mergeLinesIntoBlocks(lines) : group === "word" ? expandWords(lines) : lines;

  const accepted = grouped.filter(
    (line) => line.confidence >= minConfidence && line.text.trim().length > 0,
  );
  const skipped = grouped.length - accepted.length;
  const total = accepted.length || 1;
  const layers: TextLayer[] = [];

  accepted.forEach((line, index) => {
    const padY = Math.max(1, Math.round(line.height * padding));
    const padX = Math.max(1, Math.round(line.height * padding * 0.6));
    const rect = clampRect(
      {
        x: line.x - padX,
        y: line.y - padY,
        width: line.width + padX * 2,
        height: line.height + padY * 2,
      },
      base.width,
      base.height,
    );

    const region = getRegionImageData(base, rect);
    const { stats, ink, paper } = analyseTextRegion(region);
    const suggestions = suggestFonts(stats, line.text, 4);
    const best = suggestions[0];

    layers.push({
      id: uid("txt"),
      kind: "text",
      name: line.text.slice(0, 28) || "Text",
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      rotation: 0,
      visible: true,
      locked: false,
      text: line.text,
      fontFamily: best?.family ?? "Inter",
      fontSize: Math.max(8, Math.round(line.height * 0.78)),
      fontWeight: best?.weight ?? 400,
      italic: best?.italic ?? false,
      underline: false,
      align: "left",
      color: toHex(ink),
      opacity: 1,
      letterSpacing: 0,
      lineHeight: 1.18,
      autoFit: true,
      effects: { ...DEFAULT_EFFECTS, grain: 0.1, jpeg: 0.12 },
      patch: {
        ...DEFAULT_PATCH,
        color: toHex(paper),
        mode: stats.inkRatio > 0.32 ? "texture" : "auto",
      },
      source: {
        original: line.text,
        confidence: line.confidence,
        suggestions,
        color: toHex(ink),
        background: toHex(paper),
        detectedWeight: best?.weight,
        detectedItalic: best?.italic,
        stats,
      },
    });

    options.onProgress?.({ index: index + 1, total, label: line.text.slice(0, 40) });
  });

  return { layers, skipped };
}

function expandWords(lines: OcrLine[]): OcrLine[] {
  const words = lines.flatMap((line) => line.words);
  if (!words.length) return lines;
  return groupWordsIntoLines(words).flatMap((line) =>
    line.words.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      x: word.x,
      y: word.y,
      width: word.width,
      height: word.height,
      words: [word],
    })),
  );
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Canvas of the untouched page pixels — the reference for detection. */
export async function originalCanvas(page: { originalSrc: string; width: number; height: number }) {
  const img = await loadImage(page.originalSrc);
  return imageToCanvas(img, page.width, page.height);
}

export type { OcrProgress };
