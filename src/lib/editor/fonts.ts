import type { FontSuggestion, TextStats } from "./types";

export interface FontMeta {
  family: string;
  /** Weights available on Google Fonts for this family. */
  weights: number[];
  italic: boolean;
  class: "sans" | "serif" | "display" | "mono" | "hand";
  /** Relative width of the glyphs (1 = normal). */
  width: number;
  /** Eager load at boot — the ones used by the font matcher most often. */
  eager?: boolean;
  stack?: string;
}

/**
 * Curated pool: every family is loadable from Google Fonts and covers the
 * families the trait analyser can realistically guess. `width` encodes the
 * font's native width ratio so condensed/wide guesses stay grounded.
 */
export const FONT_POOL: FontMeta[] = [
  { family: "Inter", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 1, eager: true },
  { family: "Roboto", weights: [100, 300, 400, 500, 700, 900], italic: true, class: "sans", width: 1, eager: true },
  { family: "Open Sans", weights: [300, 400, 500, 600, 700, 800], italic: true, class: "sans", width: 1.02, eager: true },
  { family: "Lato", weights: [100, 300, 400, 700, 900], italic: true, class: "sans", width: 0.98, eager: true },
  { family: "Montserrat", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 1.05, eager: true },
  { family: "Poppins", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 1.04, eager: true },
  { family: "Merriweather", weights: [300, 400, 700, 900], italic: true, class: "serif", width: 1, eager: true },
  { family: "Playfair Display", weights: [400, 500, 600, 700, 800, 900], italic: true, class: "serif", width: 1, eager: true },
  { family: "Lora", weights: [400, 500, 600, 700], italic: true, class: "serif", width: 1 },
  { family: "Source Serif 4", weights: [200, 300, 400, 600, 700, 900], italic: true, class: "serif", width: 1 },
  { family: "PT Serif", weights: [400, 700], italic: true, class: "serif", width: 1 },
  { family: "Noto Serif", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "serif", width: 1 },
  { family: "Libre Baskerville", weights: [400, 700], italic: true, class: "serif", width: 1.02 },
  { family: "Crimson Text", weights: [400, 600, 700], italic: true, class: "serif", width: 0.96 },
  { family: "EB Garamond", weights: [400, 500, 600, 700, 800], italic: true, class: "serif", width: 0.95 },
  { family: "Bitter", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "serif", width: 1 },
  { family: "Oswald", weights: [200, 300, 400, 500, 600, 700], italic: false, class: "display", width: 0.82 },
  { family: "Anton", weights: [400], italic: false, class: "display", width: 0.8 },
  { family: "Bebas Neue", weights: [400], italic: false, class: "display", width: 0.72 },
  { family: "Archivo", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 0.98 },
  { family: "Barlow", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 0.96 },
  { family: "Barlow Condensed", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 0.78 },
  { family: "Rubik", weights: [300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 1 },
  { family: "Nunito", weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 1 },
  { family: "Work Sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 0.99 },
  { family: "DM Sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 0.98 },
  { family: "Space Grotesk", weights: [300, 400, 500, 600, 700], italic: false, class: "sans", width: 1 },
  { family: "Josefin Sans", weights: [100, 200, 300, 400, 500, 600, 700], italic: true, class: "sans", width: 0.95 },
  { family: "Fira Sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 1 },
  { family: "Titillium Web", weights: [200, 300, 400, 600, 700, 900], italic: true, class: "sans", width: 0.97 },
  { family: "Cabin", weights: [400, 500, 600, 700], italic: true, class: "sans", width: 0.97 },
  { family: "Karla", weights: [200, 300, 400, 500, 600, 700, 800], italic: true, class: "sans", width: 0.98 },
  { family: "Mulish", weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: true, class: "sans", width: 0.99 },
  { family: "Manrope", weights: [200, 300, 400, 500, 600, 700, 800], italic: false, class: "sans", width: 0.98 },
  { family: "Outfit", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, class: "sans", width: 1 },
  { family: "Abril Fatface", weights: [400], italic: false, class: "display", width: 1 },
  { family: "Alfa Slab One", weights: [400], italic: false, class: "display", width: 1 },
  { family: "Righteous", weights: [400], italic: false, class: "display", width: 1 },
  { family: "Courier Prime", weights: [400, 700], italic: true, class: "mono", width: 0.82 },
  { family: "JetBrains Mono", weights: [100, 200, 300, 400, 500, 600, 700, 800], italic: true, class: "mono", width: 0.82 },
  { family: "Roboto Mono", weights: [100, 200, 300, 400, 500, 600, 700], italic: true, class: "mono", width: 0.82 },
  { family: "Inconsolata", weights: [200, 300, 400, 500, 600, 700, 800, 900], italic: false, class: "mono", width: 0.82 },
  { family: "Caveat", weights: [400, 500, 600, 700], italic: false, class: "hand", width: 0.95 },
  { family: "Pacifico", weights: [400], italic: false, class: "hand", width: 1 },
  { family: "Dancing Script", weights: [400, 500, 600, 700], italic: false, class: "hand", width: 1 },
  { family: "Great Vibes", weights: [400], italic: false, class: "hand", width: 1 },
  { family: "Satisfy", weights: [400], italic: false, class: "hand", width: 1 },
  { family: "Permanent Marker", weights: [400], italic: false, class: "hand", width: 1 },
  { family: "Kalam", weights: [300, 400, 700], italic: false, class: "hand", width: 1 },
  { family: "Shadows Into Light", weights: [400], italic: false, class: "hand", width: 0.95 },
];

export const SYSTEM_FONTS: FontMeta[] = [
  { family: "Arial", weights: [400, 700], italic: true, class: "sans", width: 1, stack: "Arial, Helvetica, sans-serif" },
  { family: "Helvetica", weights: [400, 700], italic: true, class: "sans", width: 1, stack: "Helvetica, Arial, sans-serif" },
  { family: "Times New Roman", weights: [400, 700], italic: true, class: "serif", width: 1, stack: "'Times New Roman', Times, serif" },
  { family: "Georgia", weights: [400, 700], italic: true, class: "serif", width: 1.02, stack: "Georgia, serif" },
  { family: "Verdana", weights: [400, 700], italic: true, class: "sans", width: 1.08, stack: "Verdana, Geneva, sans-serif" },
  { family: "Tahoma", weights: [400, 700], italic: true, class: "sans", width: 1.04, stack: "Tahoma, Geneva, sans-serif" },
  { family: "Trebuchet MS", weights: [400, 700], italic: true, class: "sans", width: 1.02, stack: "'Trebuchet MS', sans-serif" },
  { family: "Courier New", weights: [400, 700], italic: true, class: "mono", width: 0.82, stack: "'Courier New', Courier, monospace" },
  { family: "Impact", weights: [400], italic: false, class: "display", width: 0.78, stack: "Impact, Haettenschweiler, sans-serif" },
  { family: "Comic Sans MS", weights: [400, 700], italic: false, class: "hand", width: 1, stack: "'Comic Sans MS', cursive" },
];

export const ALL_FONTS = [...FONT_POOL, ...SYSTEM_FONTS];

export function fontMeta(family: string): FontMeta | undefined {
  return ALL_FONTS.find((f) => f.family === family);
}

export function fontStack(family: string): string {
  const meta = fontMeta(family);
  if (meta?.stack) return meta.stack;
  const generic =
    meta?.class === "serif"
      ? "serif"
      : meta?.class === "mono"
        ? "monospace"
        : meta?.class === "hand"
          ? "cursive"
          : "sans-serif";
  return `"${family}", ${generic}`;
}

export function fontCss(
  style: { fontFamily: string; fontSize: number; fontWeight: number; italic: boolean },
  overrides: Partial<{ size: number; weight: number }> = {},
) {
  const size = overrides.size ?? style.fontSize;
  const weight = overrides.weight ?? style.fontWeight;
  return `${style.italic ? "italic " : ""}${weight} ${size}px ${fontStack(style.fontFamily)}`;
}

// ---------------------------------------------------------------------------
// Google Fonts on-demand loading
// ---------------------------------------------------------------------------

const loadedFonts = new Map<string, Promise<void>>();
const injected = new Set<string>();

function googleHref(family: string, weights: number[], italic: boolean) {
  const name = family.trim().replace(/\s+/g, "+");
  const wght = Array.from(new Set(weights)).sort((a, b) => a - b).join(";");
  const axes = italic ? `ital,wght@0,${wght};1,${wght}` : `wght@${wght}`;
  return `https://fonts.googleapis.com/css2?family=${name}:${axes}&display=swap`;
}

/** Lazily inject a Google Fonts stylesheet + await the browser font load. */
export function ensureFont(family: string, weight = 400, italic = false): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const meta = fontMeta(family);
  if (meta?.stack) return Promise.resolve(); // system font, nothing to fetch
  const key = `${family}|${weight >= 700 ? 700 : 400}|${italic}`;
  if (loadedFonts.has(key)) return loadedFonts.get(key)!;
  const weights = meta?.weights?.length ? meta.weights : [400, 700];
  const href = googleHref(family, weights, meta?.italic ?? true);
  if (!injected.has(href)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.aerotextFont = family;
    document.head.appendChild(link);
    injected.add(href);
  }
  const promise =
    typeof (document as Document & { fonts?: FontFaceSet }).fonts?.load === "function"
      ? Promise.all([
          document.fonts.load(`400 32px "${family}"`).catch(() => undefined),
          document.fonts.load(`700 32px "${family}"`).catch(() => undefined),
          italic ? document.fonts.load(`italic 400 32px "${family}"`).catch(() => undefined) : Promise.resolve(undefined),
        ]).then(() => undefined)
      : Promise.resolve();
  loadedFonts.set(key, promise);
  return promise;
}

export function preloadEagerFonts() {
  if (typeof document === "undefined") return;
  FONT_POOL.filter((f) => f.eager).forEach((font) => void ensureFont(font.family));
}

// ---------------------------------------------------------------------------
// Trait analysis → font suggestion
// ---------------------------------------------------------------------------

export interface FontTraits {
  serif: boolean;
  italic: boolean;
  weight: number;
  /** <1 condensed, >1 wide. */
  widthClass: number;
  mono: boolean;
  hand: boolean;
  uppercase: boolean;
}

/**
 * Turn the pixel statistics of a detected region (plus the OCR text) into
 * concrete font traits. Heuristics, but the same ones a human eye uses.
 */
export function analyseTraits(stats: TextStats, text: string): FontTraits {
  const letters = text.replace(/[^\p{L}]/gu, "");
  const upperRatio = letters.length ? (letters.match(/\p{Lu}/gu)?.length ?? 0) / letters.length : 0;
  const uppercase = letters.length > 1 && upperRatio > 0.8;

  // Stroke ratio: 0.06 ≈ light, 0.13 ≈ regular, 0.22 ≈ bold, 0.3+ ≈ black.
  const stroke = stats.strokeRatio;
  let weight = 400;
  if (stroke < 0.085) weight = 300;
  if (stroke < 0.06) weight = 200;
  if (stroke >= 0.125) weight = 600;
  if (stroke >= 0.16) weight = 700;
  if (stroke >= 0.21) weight = 800;
  if (stroke >= 0.27) weight = 900;

  const words = text.trim().split(/\s+/).filter(Boolean);
  const charsPerWord = words.length ? letters.length / words.length : letters.length;
  const aspect = stats.strokeRatio > 0 && stats.xHeightRatio > 0 ? charsPerWord / (stats.inkRatio * 1000 + 1) : 1;
  // Wide/narrow guess from ink density: condensed fonts pack more ink per box.
  let widthClass = 1;
  if (stats.inkRatio > 0.24) widthClass = 0.82;
  else if (stats.inkRatio > 0.18) widthClass = 0.92;
  else if (stats.inkRatio < 0.08) widthClass = 1.08;
  if (aspect < 0.0005) widthClass *= 1.02;

  const italic = Math.abs(stats.slant) > 8;
  const mono = /\d{3,}|^[A-Z0-9\s\-_.:/]{3,}$/.test(text.trim()) && /[a-z]/.test(text) === false;
  const hand = Math.abs(stats.slant) > 14 && stroke > 0.13 && stats.serifScore < 0.2;

  return {
    serif: stats.serifScore > 0.28,
    italic,
    weight,
    widthClass,
    mono,
    hand,
    uppercase,
  };
}

function scoreFont(meta: FontMeta, traits: FontTraits): { score: number; reason: string[] } {
  let score = 1;
  const reason: string[] = [];

  const isSerif = meta.class === "serif";
  if (traits.hand) {
    if (meta.class === "hand") {
      score += 0.6;
      reason.push("handwriting shape");
    } else {
      score -= 0.35;
    }
  } else if (traits.mono) {
    if (meta.class === "mono") {
      score += 0.5;
      reason.push("fixed width glyphs");
    } else {
      score -= 0.2;
    }
  } else if (isSerif === traits.serif) {
    score += 0.45;
    reason.push(traits.serif ? "serif terminals detected" : "clean sans strokes");
  } else {
    score -= 0.3;
  }

  const widthDelta = Math.abs(meta.width - traits.widthClass);
  score += 0.3 - Math.min(0.3, widthDelta * 0.9);
  if (widthDelta < 0.08) reason.push(traits.widthClass < 0.95 ? "condensed proportions" : "natural width");
  else if (widthDelta > 0.2) reason.push("width mismatch");

  if (traits.uppercase && meta.class === "display") {
    score += 0.18;
    reason.push("display caps");
  }

  // Weight proximity across the available ladder.
  const closest = meta.weights.reduce(
    (acc, w) => (Math.abs(w - traits.weight) < Math.abs(acc - traits.weight) ? w : acc),
    meta.weights[0] ?? 400,
  );
  const weightDelta = Math.abs(closest - traits.weight) / 400;
  score += 0.3 - Math.min(0.3, weightDelta);

  if (traits.italic && !meta.italic) score -= 0.12;

  return { score, reason };
}

export function suggestFonts(stats: TextStats, text: string, limit = 4): FontSuggestion[] {
  const traits = analyseTraits(stats, text);
  const ranked = FONT_POOL.map((meta) => {
    const { score, reason } = scoreFont(meta, traits);
    const closest = meta.weights.reduce(
      (acc, w) => (Math.abs(w - traits.weight) < Math.abs(acc - w) ? w : acc),
      meta.weights[0] ?? 400,
    );
    return {
      family: meta.family,
      weight: closest,
      italic: traits.italic && meta.italic,
      raw: score,
      reason: reason.join(", ") || "general match",
    };
  }).sort((a, b) => b.raw - a.raw);

  // Normalise against the best candidate so the percentage shown in the UI is
  // monotonic and comparable, instead of every score saturating at 1.
  const best = ranked[0]?.raw ?? 1;
  return ranked.slice(0, limit).map(({ raw, ...suggestion }) => ({
    ...suggestion,
    score: Math.max(0, Math.min(1, raw / (best + 0.25))),
  }));
}

/**
 * Suggest a font-size that reproduces the detected line height. Canvas text is
 * measured in a real 2D context so the browser's metrics are respected.
 */
export function fitFontSizeToBox(
  ctx: CanvasRenderingContext2D,
  options: {
    text: string;
    box: { width: number; height: number };
    fontFamily: string;
    fontWeight: number;
    italic: boolean;
    letterSpacing?: number;
    min?: number;
    max?: number;
  },
): number {
  const { text, box, fontFamily, fontWeight, italic, letterSpacing = 0 } = options;
  const min = options.min ?? 6;
  const max = Math.max(min, options.max ?? Math.max(box.height * 3, 24));
  const lines = text.split("\n");
  const fits = (size: number) => {
    ctx.font = fontCss({ fontFamily, fontSize: size, fontWeight, italic });
    const spacing = letterSpacing * size;
    const widest = Math.max(
      ...lines.map((line) => ctx.measureText(line).width + spacing * Math.max(0, line.length - 1)),
    );
    const totalHeight = lines.length * size * 1.2;
    return widest <= box.width * 1.02 && totalHeight <= box.height * 1.05;
  };
  if (fits(max)) return max;
  let low = min;
  let high = max;
  for (let i = 0; i < 22; i++) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return Math.max(min, Math.floor(low * 10) / 10);
}
