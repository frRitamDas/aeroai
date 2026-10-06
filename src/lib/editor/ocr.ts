"use client";

import type { OcrLine, OcrState, OcrWord } from "./types";

export interface OcrProgress {
  status: OcrState["status"];
  progress: number;
  message: string;
}

export type GroupMode = "word" | "line" | "block";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" ? (value as AnyRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normaliseBBox(raw: unknown): { x: number; y: number; width: number; height: number } | null {
  const bbox = asRecord(raw);
  if (!bbox) return null;
  const x0 = Number(bbox.x0 ?? bbox.left ?? 0);
  const y0 = Number(bbox.y0 ?? bbox.top ?? 0);
  const x1 = Number(bbox.x1 ?? bbox.right ?? x0 + Number(bbox.width ?? 0));
  const y1 = Number(bbox.y1 ?? bbox.bottom ?? y0 + Number(bbox.height ?? 0));
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return null;
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

function toWord(raw: unknown, fallbackLine = 0): OcrWord | null {
  const record = asRecord(raw);
  if (!record) return null;
  const bbox = normaliseBBox(record.bbox ?? record);
  const text = String(record.text ?? "").replace(/\s+$/g, "");
  if (!bbox || !text.trim()) return null;
  return {
    text,
    confidence: Number(record.confidence ?? record.conf ?? 0),
    ...bbox,
    lineIndex: fallbackLine,
  };
}

function toLine(raw: unknown, index: number): OcrLine | null {
  const record = asRecord(raw);
  if (!record) return null;
  const bbox = normaliseBBox(record.bbox ?? record);
  const words = asArray(record.words)
    .map((word) => toWord(word, index))
    .filter((word): word is OcrWord => Boolean(word));
  const text = String(record.text ?? words.map((w) => w.text).join(" "))
    .replace(/\s+/g, " ")
    .trim();
  const bounds =
    bbox ??
    (words.length
      ? {
          x: Math.min(...words.map((w) => w.x)),
          y: Math.min(...words.map((w) => w.y)),
          width:
            Math.max(...words.map((w) => w.x + w.width)) - Math.min(...words.map((w) => w.x)),
          height:
            Math.max(...words.map((w) => w.y + w.height)) - Math.min(...words.map((w) => w.y)),
        }
      : null);
  if (!bounds || !text) return null;
  const confidence = Number(
    record.confidence ??
      (words.length ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length : 0),
  );
  return { text, confidence, ...bounds, words };
}

/**
 * Tesseract's output shape has moved around between major versions
 * (blocks → paragraphs → lines → words, plus a TSV renderer). Rather than
 * pinning one shape we walk whatever comes back and normalise it.
 */
export function extractLines(data: unknown): OcrLine[] {
  const record = asRecord(data);
  if (!record) return [];

  // Preferred: nested blocks → paragraphs → lines.
  const blocks = asArray(record.blocks);
  if (blocks.length) {
    const lines: OcrLine[] = [];
    for (const block of blocks) {
      const blockRecord = asRecord(block);
      if (!blockRecord) continue;
      for (const paragraph of asArray(blockRecord.paragraphs)) {
        const paragraphRecord = asRecord(paragraph);
        if (!paragraphRecord) continue;
        for (const line of asArray(paragraphRecord.lines)) {
          const normalised = toLine(line, lines.length);
          if (normalised) lines.push(normalised);
        }
      }
    }
    if (lines.length) return lines;
  }

  const flatLines = asArray(record.lines);
  if (flatLines.length) {
    const lines = flatLines
      .map((line, index) => toLine(line, index))
      .filter((line): line is OcrLine => Boolean(line));
    if (lines.length) return lines;
  }

  const words = asArray(record.words)
    .map((word) => toWord(word))
    .filter((word): word is OcrWord => Boolean(word));
  if (words.length) return groupWordsIntoLines(words);

  // Last resort: parse the TSV renderer output (level 5 = word).
  const tsv = typeof record.tsv === "string" ? record.tsv : "";
  if (tsv) return groupWordsIntoLines(parseTsvWords(tsv));
  return [];
}

export function parseTsvWords(tsv: string): OcrWord[] {
  const words: OcrWord[] = [];
  const rows = tsv.split("\n").slice(1);
  for (const row of rows) {
    const cols = row.split("\t");
    if (cols.length < 12) continue;
    const level = Number(cols[0]);
    if (level !== 5) continue;
    const text = cols[11]?.trim();
    if (!text) continue;
    const x = Number(cols[6]);
    const y = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    words.push({
      text,
      confidence: Number(cols[10]) || 0,
      x,
      y,
      width: Math.max(1, width),
      height: Math.max(1, height),
      lineIndex: 0,
    });
  }
  return words;
}

/** Cluster words into lines by overlapping baselines (works for any OCR shape). */
export function groupWordsIntoLines(words: OcrWord[]): OcrLine[] {
  if (!words.length) return [];
  const sorted = [...words].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  const lines: OcrWord[][] = [];
  for (const word of sorted) {
    const centre = word.y + word.height / 2;
    const target = lines.find((line) => {
      const ref = line[0];
      const refCentre = ref.y + ref.height / 2;
      return Math.abs(refCentre - centre) < Math.max(ref.height, word.height) * 0.6;
    });
    if (target) target.push(word);
    else lines.push([word]);
  }
  return lines.map((line, index) => {
    const ordered = [...line].sort((a, b) => a.x - b.x);
    const x = Math.min(...ordered.map((w) => w.x));
    const y = Math.min(...ordered.map((w) => w.y));
    const right = Math.max(...ordered.map((w) => w.x + w.width));
    const bottom = Math.max(...ordered.map((w) => w.y + w.height));
    const withIndex = ordered.map((w) => ({ ...w, lineIndex: index }));
    return {
      text: withIndex.map((w) => w.text).join(" "),
      confidence: withIndex.reduce((sum, w) => sum + w.confidence, 0) / withIndex.length,
      x,
      y,
      width: right - x,
      height: bottom - y,
      words: withIndex,
    };
  });
}

export interface RecognizeOptions {
  language?: string;
  onProgress?: (progress: OcrProgress) => void;
  /** Crop of the page to recognise, in document pixels. */
  region?: { x: number; y: number; width: number; height: number };
}

interface TesseractWorkerLike {
  recognize: (
    image: unknown,
    options?: unknown,
    output?: unknown,
  ) => Promise<{ data: unknown }>;
  terminate: () => Promise<unknown>;
}

let activeWorker: TesseractWorkerLike | null = null;
let activeLanguage = "";

/**
 * Thin wrapper around tesseract.js. The worker is cached per language: model
 * downloads are the slow part, so we never re-create it needlessly.
 */
export async function recognize(
  source: HTMLCanvasElement | ImageData | Blob | string,
  options: RecognizeOptions = {},
): Promise<OcrLine[]> {
  const language = options.language ?? "eng";
  const progress = options.onProgress ?? (() => {});
  progress({ status: "loading", progress: 0.02, message: "Loading OCR engine…" });

  const { createWorker } = await import("tesseract.js");
  if (!activeWorker || activeLanguage !== language) {
    if (activeWorker) await activeWorker.terminate().catch(() => undefined);
    activeLanguage = language;
    activeWorker = (await createWorker(language, 1, {
      logger: (message: { status?: string; progress?: number }) => {
        progress({
          status: "recognising",
          progress: Math.max(0.05, Math.min(0.98, Number(message.progress ?? 0))),
          message: humanize(message.status ?? "recognising text"),
        });
      },
    })) as unknown as TesseractWorkerLike;
  }

  progress({ status: "recognising", progress: 0.1, message: "Reading text…" });
  const input = options.region ? cropSource(source, options.region) : source;
  const result = await activeWorker.recognize(input, {}, { blocks: true, text: true, tsv: true });
  let lines = extractLines(result.data);
  if (options.region) {
    lines = lines.map((line) => ({
      ...line,
      x: line.x + options.region!.x,
      y: line.y + options.region!.y,
      words: line.words.map((word) => ({
        ...word,
        x: word.x + options.region!.x,
        y: word.y + options.region!.y,
      })),
    }));
  }
  progress({ status: "done", progress: 1, message: `Found ${lines.length} text lines` });
  return lines;
}

function cropSource(
  source: HTMLCanvasElement | ImageData | Blob | string,
  region: { x: number; y: number; width: number; height: number },
) {
  if (typeof document === "undefined") return source;
  if (!(source instanceof HTMLCanvasElement) && !(source instanceof ImageData)) return source;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width));
  canvas.height = Math.max(1, Math.round(region.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  if (source instanceof HTMLCanvasElement) {
    ctx.drawImage(
      source,
      region.x,
      region.y,
      region.width,
      region.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  } else {
    const tmp = document.createElement("canvas");
    tmp.width = source.width;
    tmp.height = source.height;
    tmp.getContext("2d")?.putImageData(source, 0, 0);
    ctx.drawImage(tmp, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

export async function terminateOcr() {
  if (activeWorker) {
    await activeWorker.terminate().catch(() => undefined);
    activeWorker = null;
    activeLanguage = "";
  }
}

function humanize(status: string) {
  switch (status) {
    case "loading tesseract core":
      return "Loading OCR core…";
    case "initializing tesseract":
      return "Starting OCR engine…";
    case "loading language traineddata":
      return "Downloading language data…";
    case "initializing api":
      return "Preparing language…";
    case "recognizing text":
      return "Recognising text…";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
