/**
 * Domain model for the AeroText Studio editor.
 *
 * A document (project) is a list of pages. Every page keeps an immutable
 * reference to the pixels the user opened (`originalSrc`) plus a small,
 * fully serialisable description of everything the user did to it
 * (`layers` + `brushBatches`). The rendered result is derived, never stored —
 * which keeps undo/redo, project files and autosave tiny and fast.
 */

export type ToolId = "select" | "text" | "box" | "heal" | "pick" | "pan";

export type TextAlign = "left" | "center" | "right";

export type PatchMask = "auto" | "glyph" | "box";
export type PatchMode = "auto" | "texture" | "diffusion" | "color" | "none";

export interface PatchSettings {
  /** Remove the original text under this layer. */
  enabled: boolean;
  mode: PatchMode;
  /** Which pixels get healed. `auto` = glyph mask when we trust the detection. */
  mask: PatchMask;
  /** Flat colour used by `color` mode / texture fallbacks. */
  color: string;
  /** Soft edge in px. */
  feather: number;
  /** Grow the heal region (px) — helps with anti-aliased edges & bleed. */
  expand: number;
  /** Vertical offset (px) used when cloning surrounding texture. `0` = auto. */
  textureOffset: number;
  /** Diffusion strength 0..1 (higher = smoother, slower). */
  strength: number;
}

export interface TextEffects {
  /** Ink bleed / anti-alias softness of the printed glyphs (0..1). */
  inkSpread: number;
  /** Optical softness, e.g. out-of-focus scans (0..1). */
  softness: number;
  /** Film / paper grain added on top of the glyphs (0..1). */
  grain: number;
  /** Simulated JPEG ringing + blockiness inside the text box (0..1). */
  jpeg: number;
  /** Per-glyph opacity jitter, mimics uneven toner (0..1). */
  opacityJitter: number;
  /** Blend the new glyph edges into the background (0..1). */
  blendEdges: number;
}

export interface SourceInfo {
  /** Text as recognised by OCR. */
  original: string;
  confidence: number;
  /** Font suggestions produced by trait analysis. */
  suggestions: FontSuggestion[];
  /** Sampled ink colour of the original text. */
  color?: string;
  /** Sampled background colour under the original text. */
  background?: string;
  detectedWeight?: number;
  detectedItalic?: boolean;
  stats?: TextStats;
}

export interface TextStats {
  /** Ink coverage inside the box (0..1). */
  inkRatio: number;
  /** Mean stroke thickness / glyph height. */
  strokeRatio: number;
  /** Estimated slant in degrees. Positive = italic. */
  slant: number;
  /** Heuristic serif confidence 0..1. */
  serifScore: number;
  /** x-height / cap-height ratio. */
  xHeightRatio: number;
}

export interface FontSuggestion {
  family: string;
  weight: number;
  italic: boolean;
  score: number;
  reason: string;
}

export interface BaseLayer {
  id: string;
  kind: LayerKind;
  name: string;
  /** Document-space (page pixel) geometry, before rotation. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, around the layer centre. */
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export type LayerKind = "text" | "cleanup";

export interface TextLayer extends BaseLayer {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  color: string;
  opacity: number;
  letterSpacing: number;
  lineHeight: number;
  /** Shrink/grow text so it fills the box height. */
  autoFit: boolean;
  effects: TextEffects;
  patch: PatchSettings;
  source?: SourceInfo;
}

export interface CleanupLayer extends BaseLayer {
  kind: "cleanup";
  patch: PatchSettings;
}

export type Layer = TextLayer | CleanupLayer;

export interface BrushStroke {
  /** Flat [x0,y0,x1,y1,...] document-space points. */
  points: number[];
  size: number;
  hardness: number;
  mode: BrushMode;
  /** Sampled colour for `color` mode. */
  color: string;
  /** Clone-source offset in document px. */
  offsetX: number;
  offsetY: number;
  /** Radial fingerprint used by `blur` mode. */
  blur: number;
}

export type BrushMode = "clone" | "color" | "blur";

export interface BrushBatch {
  id: string;
  strokes: BrushStroke[];
  /** Bumped whenever the strokes change so raster caches invalidate. */
  revision: number;
}

export type PageKind = "image" | "pdf";

export interface Page {
  id: string;
  kind: PageKind;
  name: string;
  width: number;
  height: number;
  /** Source pixels: data URL for images, rendered page for PDFs. */
  originalSrc: string;
  /** PDF metadata. */
  pdfPage?: number;
  pdfPageCount?: number;
  layers: Layer[];
  brushBatches: BrushBatch[];
  /** 0..1 — background colour confidence for the page texture. */
  paperLuminance?: number;
}

export interface DocumentSnapshot {
  pages: Page[];
  activePageId: string | null;
  selection: string[];
}

export interface OcrWord {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  lineIndex: number;
}

export interface OcrLine {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  words: OcrWord[];
}

export type OcrStatus = "idle" | "loading" | "recognising" | "done" | "error";

export interface OcrState {
  status: OcrStatus;
  progress: number;
  message: string;
  language: string;
  lines: number;
  lastError?: string;
}

export interface BrushSettings {
  size: number;
  hardness: number;
  mode: BrushMode;
  color: string;
  /** `null` until the user alt-clicks a clone source. */
  source: { x: number; y: number } | null;
  opacity: number;
}

export interface ExportSettings {
  format: "png" | "jpeg" | "webp" | "pdf";
  quality: number;
  scale: number;
  pageMode: "current" | "all";
  filename: string;
}

export const DEFAULT_EFFECTS: TextEffects = {
  inkSpread: 0.18,
  softness: 0.06,
  grain: 0.12,
  jpeg: 0.1,
  opacityJitter: 0.08,
  blendEdges: 0.25,
};

export const DEFAULT_PATCH: PatchSettings = {
  enabled: true,
  mode: "auto",
  mask: "auto",
  color: "#ffffff",
  feather: 2,
  expand: 1,
  textureOffset: 0,
  strength: 0.6,
};

export const DEFAULT_BRUSH: BrushSettings = {
  size: 42,
  hardness: 0.6,
  mode: "clone",
  color: "#ffffff",
  source: null,
  opacity: 1,
};

export const OCR_LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "por", label: "Portuguese" },
  { code: "ita", label: "Italian" },
  { code: "nld", label: "Dutch" },
  { code: "rus", label: "Russian" },
  { code: "ukr", label: "Ukrainian" },
  { code: "tur", label: "Turkish" },
  { code: "ara", label: "Arabic" },
  { code: "hin", label: "Hindi" },
  { code: "ben", label: "Bengali" },
  { code: "urd", label: "Urdu" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "chi_tra", label: "Chinese (Traditional)" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
  { code: "vie", label: "Vietnamese" },
  { code: "ind", label: "Indonesian" },
  { code: "tha", label: "Thai" },
] as const;

export const MAX_HISTORY = 60;

/**
 * A partial update that may target any layer field. `Partial<Layer>` would be a
 * union of partials (so `patch.effects` is not accessible), therefore we model
 * the patch explicitly.
 */
export type LayerPatch = Partial<Omit<TextLayer, "kind" | "effects" | "patch">> &
  Partial<Omit<CleanupLayer, "kind" | "patch">> & {
    kind?: LayerKind;
    effects?: Partial<TextEffects>;
    patch?: Partial<PatchSettings>;
  };

export type LayerUpdate = LayerPatch;
