import { blurImageData } from "./effects";
import { clusterForegroundBackground, hexToRgb, rgbCss, type Rgb } from "./color";
import { seededRandom } from "@/lib/utils";
import type { PatchMask, PatchMode } from "./types";

export interface HealOptions {
  mode: PatchMode;
  mask: PatchMask;
  /** Flat colour for `color` mode. */
  color: string;
  /** Soft edge, in px. */
  feather: number;
  /** Growth of the heal region, in px. */
  expand: number;
  /** 0 = auto detect a clean donor band. */
  textureOffset: number;
  /** 0..1 diffusion strength. */
  strength: number;
  /** Override the diffusion iteration count (lower = faster draft render). */
  iterations?: number;
  ink?: Rgb;
  paper?: Rgb;
  seed?: number;
}

export interface HealAnalysis {
  /** Fraction of pixels the glyph mask selected. */
  coverage: number;
  /** Luminance variance of the surrounding ring — high = photographic. */
  textureVariance: number;
  /** True when the region is essentially flat paper/colour. */
  flat: boolean;
  ink: Rgb;
  paper: Rgb;
}

const DEFAULT_HEAL: HealOptions = {
  mode: "auto",
  mask: "auto",
  color: "#ffffff",
  feather: 2,
  expand: 1,
  textureOffset: 0,
  strength: 0.6,
};

function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Luminance variance of the ring around the core area (halo pixels). */
export function ringVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  core: { x: number; y: number; width: number; height: number },
): { variance: number; mean: number } {
  let sum = 0;
  let sq = 0;
  let n = 0;
  const stepX = Math.max(1, Math.floor(core.width / 64));
  const stepY = Math.max(1, Math.floor(core.height / 16));
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const inCore =
        x >= core.x && x < core.x + core.width && y >= core.y && y < core.y + core.height;
      if (inCore) continue;
      const idx = (y * width + x) * 4;
      if (data[idx + 3] < 16) continue;
      const l = luma(data[idx], data[idx + 1], data[idx + 2]);
      sum += l;
      sq += l * l;
      n++;
    }
  }
  if (!n) return { variance: 0, mean: 0 };
  const mean = sum / n;
  return { variance: Math.max(0, sq / n - mean * mean), mean };
}

/**
 * Analyse a text region to decide the best removal strategy: an OCR style
 * glyph mask for flat paper, a full-box fill for textured photos, and the
 * ink/paper colours to feed the UI swatches.
 */
export function analyseHeal(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  core: { x: number; y: number; width: number; height: number },
  options: Partial<HealOptions> = {},
): HealAnalysis {
  const opts = { ...DEFAULT_HEAL, ...options };
  const coreData = cropData(data, width, height, core);
  const { fg, bg } = clusterForegroundBackground(coreData);
  const ink = opts.ink ?? fg;
  const paper = opts.paper ?? bg;
  const mask = buildGlyphMask(coreData, core.width, core.height, ink, paper);
  let masked = 0;
  for (let i = 0; i < mask.length; i++) masked += mask[i];
  const coverage = mask.length ? masked / mask.length : 0;
  const { variance } = ringVariance(data, width, height, core);
  return {
    coverage,
    textureVariance: variance,
    flat: variance < 90 || coverage < 0.004,
    ink,
    paper,
  };
}

function cropData(
  data: Uint8ClampedArray,
  width: number,
  _height: number,
  rect: { x: number; y: number; width: number; height: number },
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    const srcStart = ((rect.y + y) * width + rect.x) * 4;
    out.set(data.subarray(srcStart, srcStart + rect.width * 4), y * rect.width * 4);
  }
  return out;
}

/**
 * Glyph (ink) mask. Kept as a standalone export because it powers both the
 * removal engine and the "what will be erased" preview overlay in the UI.
 */
export function buildGlyphMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  ink: Rgb,
  paper: Rgb,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const inkLum = luma(ink.r, ink.g, ink.b);
  const paperLum = luma(paper.r, paper.g, paper.b);
  const dark = inkLum < paperLum;
  const separation = Math.abs(paperLum - inkLum);
  // The threshold sits deliberately close to the paper side: sub-pixel
  // anti-aliasing leaves a 1-2px ramp around every glyph, and any ramp pixel
  // left outside the mask survives as a ghost of the original text.
  const threshold = dark ? inkLum + separation * 0.82 : inkLum - separation * 0.82;
  const tolerance = Math.max(8, separation * 0.1);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 24) {
      mask[p] = 0;
      continue;
    }
    const l = luma(data[i], data[i + 1], data[i + 2]);
    const isInk = dark ? l < threshold + tolerance : l > threshold - tolerance;
    mask[p] = isInk ? 1 : 0;
  }
  return mask;
}

/**
 * Grow a binary mask by `radius` (Chebyshev distance) so the *original* ink is
 * always fully covered, then blur it so the healed pixels dissolve into their
 * surroundings. Dilating first is what keeps thin strokes from surviving as
 * grey halos after a soft feather.
 */
export function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(height - 1, y + r);
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width - 1, x + r);
      for (let ny = y0; ny <= y1; ny++) out.fill(1, ny * width + x0, ny * width + x1 + 1);
    }
  }
  return out;
}

/** Shrink a mask by `radius` (Chebyshev distance) — the "interior" of a mask. */
export function erodeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;
      let keep = true;
      for (let dy = -r; dy <= r && keep; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) {
          keep = false;
          break;
        }
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width || !mask[ny * width + nx]) {
            keep = false;
            break;
          }
        }
      }
      out[p] = keep ? 1 : 0;
    }
  }
  return out;
}

/**
 * Soften a binary mask so healed pixels blend seamlessly into the original.
 * The mask is dilated by `radius` first, so the stroke interior keeps full
 * coverage while the edge fades out.
 */
export function featherMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  if (radius < 0.5) {
    const out = new Float32Array(mask.length);
    for (let i = 0; i < mask.length; i++) out[i] = mask[i];
    return out;
  }
  const dilated = dilateMask(mask, width, height, radius);
  const rgba = new Uint8ClampedArray(mask.length * 4);
  for (let i = 0; i < mask.length; i++) {
    const v = dilated[i] ? 255 : 0;
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  blurImageData(rgba, width, height, Math.max(1, radius * 0.9));
  const out = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = rgba[i * 4] / 255;
  return out;
}

/** Mean colour of the unmasked "ring" pixels — the paper colour of a region. */
export function ringMeanColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array | null,
): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let p = 0; p < width * height; p++) {
    if (mask && mask[p]) continue;
    const idx = p * 4;
    if (data[idx + 3] < 16) continue;
    r += data[idx];
    g += data[idx + 1];
    b += data[idx + 2];
    n++;
  }
  if (!n) return { r: 255, g: 255, b: 255 };
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Pick the vertical donor offset that lands on the "cleanest" band: the one
 * whose unmasked pixels are closest to the ring colour and lowest variance.
 * This is how we avoid cloning neighbouring letters into the healed area.
 */
export function findDonorOffset(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array,
  ringColor: Rgb,
  preferred = 0,
): { offsetX: number; offsetY: number; score: number } {
  if (preferred !== 0) return { offsetX: 0, offsetY: Math.round(preferred), score: 0 };
  const candidates: { ox: number; oy: number }[] = [];
  const maxShift = Math.max(4, Math.min(64, Math.round(height * 0.9)));
  for (let shift = 3; shift <= maxShift; shift += 2) {
    candidates.push({ ox: 0, oy: shift }, { ox: 0, oy: -shift });
  }
  for (let shift = 3; shift <= Math.max(6, Math.round(width * 0.25)); shift += 3) {
    candidates.push({ ox: shift, oy: 0 }, { ox: -shift, oy: 0 });
  }

  let best = { ox: 0, oy: -Math.max(3, Math.round(height * 0.6)), score: Infinity };
  const ringLum = luma(ringColor.r, ringColor.g, ringColor.b);

  for (const cand of candidates) {
    let score = 0;
    let varianceSum = 0;
    let varianceSq = 0;
    let sampled = 0;
    let onInk = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (!mask[p]) continue;
        sampled++;
        const sx = x + cand.ox;
        const sy = y + cand.oy;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) {
          score += 400;
          continue;
        }
        const sp = sy * width + sx;
        // A donor that lands on ink from another glyph is useless, no matter
        // how clean the rest of the band is.
        if (mask[sp]) {
          onInk++;
          score += 600;
          continue;
        }
        const idx = sp * 4;
        const l = luma(data[idx], data[idx + 1], data[idx + 2]);
        score += Math.abs(l - ringLum);
        varianceSum += l;
        varianceSq += l * l;
      }
    }
    if (!sampled) continue;
    const inkRatio = onInk / sampled;
    const clean = Math.max(1, sampled - onInk);
    const mean = varianceSum / clean;
    const variance = Math.max(0, varianceSq / clean - mean * mean);
    // Ink overlap dominates the ranking; tone drift only counts a little
    // because texture mode rebuilds the low frequencies anyway.
    const total = inkRatio * 500 + (score / clean) * 0.5 + variance * 0.03;
    if (total < best.score) best = { ox: cand.ox, oy: cand.oy, score: total };
  }
  return { offsetX: best.ox, offsetY: best.oy, score: best.score };
}

/**
 * Diffuse-heal: iterative neighbour averaging with a multi-scale warm start.
 * Fast enough for glyph masks (thin strokes) yet smooth over big blocks.
 */
export function diffusionFill(
  image: ImageData,
  mask: Uint8Array,
  options: { iterations?: number; strength?: number } = {},
) {
  const { width, height, data } = image;
  const strength = Math.max(0, Math.min(1, options.strength ?? 0.6));
  const iterations = options.iterations ?? Math.max(8, Math.min(220, Math.round(Math.max(width, height) * 0.35)));

  const channelCount = 4;
  const current = new Float32Array(width * height * channelCount);
  for (let p = 0; p < width * height; p++) {
    const idx = p * 4;
    current[p * 4] = data[idx];
    current[p * 4 + 1] = data[idx + 1];
    current[p * 4 + 2] = data[idx + 2];
    current[p * 4 + 3] = data[idx + 3];
  }

  // Seed masked pixels with the mean of their known neighbours.
  const seed = new Float32Array(4);
  let seedN = 0;
  for (let p = 0; p < width * height; p++) {
    if (!mask[p]) continue;
    const idx = p * 4;
    seed[0] += current[idx];
    seed[1] += current[idx + 1];
    seed[2] += current[idx + 2];
    seed[3] += current[idx + 3];
    seedN++;
  }
  if (seedN) {
    for (let c = 0; c < 4; c++) seed[c] /= seedN;
    for (let p = 0; p < width * height; p++) {
      if (!mask[p]) continue;
      for (let c = 0; c < 4; c++) current[p * 4 + c] = seed[c];
    }
  }

  const next = new Float32Array(current);
  const isInside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const blur = 1 - strength; // blend factor towards the blurred estimate

  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (!mask[p]) continue;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumA = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (!isInside(nx, ny)) continue;
            const np = ny * width + nx;
            const w = dx === 0 || dy === 0 ? 2 : 1;
            const idx = np * 4;
            sumR += current[idx] * w;
            sumG += current[idx + 1] * w;
            sumB += current[idx + 2] * w;
            sumA += current[idx + 3] * w;
            n += w;
          }
        }
        if (!n) continue;
        const idx = p * 4;
        const blend = 1 - blur * 0.5;
        next[idx] = current[idx] * (1 - blend) + (sumR / n) * blend;
        next[idx + 1] = current[idx + 1] * (1 - blend) + (sumG / n) * blend;
        next[idx + 2] = current[idx + 2] * (1 - blend) + (sumB / n) * blend;
        next[idx + 3] = current[idx + 3] * (1 - blend) + (sumA / n) * blend;
      }
    }
    current.set(next);
  }

  const out = new ImageData(width, height);
  for (let p = 0; p < width * height; p++) {
    out.data[p * 4] = current[p * 4];
    out.data[p * 4 + 1] = current[p * 4 + 1];
    out.data[p * 4 + 2] = current[p * 4 + 2];
    out.data[p * 4 + 3] = current[p * 4 + 3];
  }
  return out;
}

/**
 * Copy paper texture (high frequency detail) from the surrounding ring into
 * the freshly healed area. Without this the patch looks like a blurry smear
 * on any photographed document.
 */
export function transferTexture(
  healed: ImageData,
  original: ImageData,
  mask: Uint8Array,
  options: {
    offsetX?: number;
    offsetY?: number;
    amount?: number;
    neighbourRadius?: number;
    /** Clamp for the copied detail (in 8-bit levels). */
    maxResidual?: number;
  } = {},
) {
  const { width, height } = healed;
  const amount = options.amount ?? 0.85;
  const ox = options.offsetX ?? 0;
  const oy = options.offsetY ?? 0;
  if (amount <= 0.001 || (!ox && !oy)) return;

  // Low frequency version of the original, so residuals carry only details.
  const low = new ImageData(new Uint8ClampedArray(original.data), width, height);
  blurImageData(low.data, width, height, options.neighbourRadius ?? 2.5);

  const maxResidual = options.maxResidual ?? 14;

  // Two-pass: measure the mean residual of the donor pixels first. Subtracting
  // it keeps the patch's average tone exactly at the healed (ring-matched)
  // level — only texture travels, never the donor's brightness.
  const sums = [0, 0, 0];
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;
      const sx = Math.max(0, Math.min(width - 1, x + ox));
      const sy = Math.max(0, Math.min(height - 1, y + oy));
      const sIdx = (sy * width + sx) * 4;
      for (let c = 0; c < 3; c++) sums[c] += original.data[sIdx + c] - low.data[sIdx + c];
      count++;
    }
  }
  if (!count) return;
  const meanResidual = sums.map((sum) => sum / count);

  const rand = seededRandom(1337);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;
      const sx = Math.max(0, Math.min(width - 1, x + ox));
      const sy = Math.max(0, Math.min(height - 1, y + oy));
      const sIdx = (sy * width + sx) * 4;
      const dIdx = p * 4;
      const weight = amount * (0.75 + rand() * 0.25);
      for (let c = 0; c < 3; c++) {
        // Remove the DC offset, then clamp so a strong edge in the donor band
        // (the bottom of a neighbouring glyph, a crease) cannot ghost through.
        const residual = Math.max(
          -maxResidual,
          Math.min(maxResidual, original.data[sIdx + c] - low.data[sIdx + c] - meanResidual[c]),
        );
        healed.data[dIdx + c] = Math.max(
          0,
          Math.min(255, healed.data[dIdx + c] + residual * weight),
        );
      }
    }
  }
  // Rebuild alpha inside the mask so transparent source pixels don't leak.
  for (let p = 0; p < width * height; p++) {
    if (!mask[p]) continue;
    healed.data[p * 4 + 3] = 255;
  }
}

export interface HealResult {
  region: ImageData;
  mode: PatchMode;
  analysis: HealAnalysis;
  coverage: number;
}

/**
 * The public entry point: heal every pixel the mask selected inside `core`.
 * `image` must be a padded region (the halo is used as source material).
 */
export function healRegion(
  image: ImageData,
  core: { x: number; y: number; width: number; height: number },
  options: Partial<HealOptions> = {},
): HealResult {
  const opts: HealOptions = { ...DEFAULT_HEAL, ...options };
  const { width, height } = image;
  const analysis = analyseHeal(image.data, width, height, core, opts);
  const ink = opts.ink ?? analysis.ink;
  const paper = opts.paper ?? analysis.paper;

  const coreMask = buildGlyphMask(
    cropData(image.data, width, height, core),
    core.width,
    core.height,
    ink,
    paper,
  );
  const fillAll =
    opts.mask === "box" || (opts.mask === "auto" && analysis.flat === false && analysis.coverage > 0.65);

  // The healer must replace the glyphs *and* their anti-aliased fringe: only
  // filling the raw ink mask is what leaves ghost lettering behind after a
  // feather. So the working mask is the glyph mask dilated by the softening
  // radius (the caller has already grown the core rect by `expand`).
  const mask = new Uint8Array(width * height);
  if (fillAll) {
    for (let y = 0; y < core.height; y++) {
      mask.fill(1, (core.y + y) * width + core.x, (core.y + y) * width + core.x + core.width);
    }
  } else {
    for (let y = 0; y < core.height; y++) {
      for (let x = 0; x < core.width; x++) {
        mask[(core.y + y) * width + (core.x + x)] = coreMask[y * core.width + x];
      }
    }
  }

  // `coverage` keeps its user-facing meaning: the real detected ink footprint.
  const rawCoverage = analysis.coverage;
  const healMask = fillAll
    ? mask
    : dilateMask(mask, width, height, Math.max(1, Math.round(opts.feather) + 1));

  let mode = opts.mode;
  if (mode === "auto") {
    // Flat paper with dense ink (a scanned receipt) is best served by a plain
    // tone fill; anything textured goes through the inpaint pipeline.
    if (analysis.flat && rawCoverage > 0.4) mode = "color";
    else if (analysis.flat) mode = "texture";
    else mode = "diffusion";
  }

  const original = new ImageData(new Uint8ClampedArray(image.data), width, height);
  let healed: ImageData;

  let inkPixels = 0;
  for (let i = 0; i < healMask.length; i++) if (healMask[i]) inkPixels++;
  if (inkPixels === 0) {
    return { region: original, mode, analysis, coverage: rawCoverage };
  }

  switch (mode) {
    case "none": {
      healed = original;
      break;
    }
    case "color": {
      const { r, g, b } = opts.color
        ? hexToRgb(opts.color)
        : ringMeanColor(image.data, width, height, healMask);
      healed = new ImageData(new Uint8ClampedArray(image.data), width, height);
      for (let p = 0; p < width * height; p++) {
        if (!healMask[p]) continue;
        const idx = p * 4;
        healed.data[idx] = r;
        healed.data[idx + 1] = g;
        healed.data[idx + 2] = b;
        healed.data[idx + 3] = 255;
      }

      // Flat fills are perfect on studio backgrounds but betray themselves on
      // photographed paper, where the paper tone drifts across the frame. The
      // drift is recovered from a coarse local average of the *surroundings*
      // and applied as a relative offset, so the fill keeps exactly the colour
      // the user asked for while the gradient stays continuous.
      {
        const grid = 14;
        const cols = Math.max(1, Math.ceil(width / grid));
        const rows = Math.max(1, Math.ceil(height / grid));
        const sums = [new Float64Array(cols * rows), new Float64Array(cols * rows), new Float64Array(cols * rows)];
        const counts = new Float64Array(cols * rows);
        const global = [0, 0, 0];
        let globalCount = 0;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const p = y * width + x;
            if (healMask[p]) continue;
            const cell = ((y / grid) | 0) * cols + ((x / grid) | 0);
            const d = p * 4;
            for (let c = 0; c < 3; c++) {
              sums[c][cell] += image.data[d + c];
              global[c] += image.data[d + c];
            }
            counts[cell]++;
            globalCount++;
          }
        }

        if (globalCount > 0) {
          for (let c = 0; c < 3; c++) global[c] /= globalCount;
          const base = [r, g, b];
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const p = y * width + x;
              if (!healMask[p]) continue;
              const cy = (y / grid) | 0;
              const cx = (x / grid) | 0;
              let wSum = 0;
              const local = [0, 0, 0];
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const ny = cy + dy;
                  const nx = cx + dx;
                  if (ny < 0 || nx < 0 || ny >= rows || nx >= cols) continue;
                  const cell = ny * cols + nx;
                  if (!counts[cell]) continue;
                  const weight = dx === 0 && dy === 0 ? 2 : 1;
                  for (let c = 0; c < 3; c++) local[c] += (sums[c][cell] / counts[cell]) * weight;
                  wSum += weight;
                }
              }
              const d = p * 4;
              if (wSum > 0) {
                for (let c = 0; c < 3; c++) {
                  const drift = local[c] / wSum - global[c];
                  healed.data[d + c] = Math.max(0, Math.min(255, base[c] + drift));
                }
              }
            }
          }
        }
      }
      break;
    }
    case "texture": {
      // Hybrid: the low frequencies come from an inpaint so a gradient or a
      // light falloff is never broken, and the high frequencies (paper grain,
      // fabric, noise) are copied from the cleanest donor band we can find.
      // Cloning raw donor pixels would paste the donor's brightness onto the
      // patch; residuals are zero-mean, so only texture travels.
      const ringColor = ringMeanColor(image.data, width, height, healMask);
      const donor = findDonorOffset(image.data, width, height, healMask, ringColor, opts.textureOffset);
      healed = diffusionFill(image, healMask, {
        strength: opts.strength,
        iterations: opts.iterations,
      });
      for (let p = 0; p < width * height; p++) {
        if (!healMask[p]) continue;
        const idx = p * 4;
        healed.data[idx] = Math.max(0, Math.min(255, healed.data[idx] * 0.5 + ringColor.r * 0.5));
        healed.data[idx + 1] = Math.max(0, Math.min(255, healed.data[idx + 1] * 0.5 + ringColor.g * 0.5));
        healed.data[idx + 2] = Math.max(0, Math.min(255, healed.data[idx + 2] * 0.5 + ringColor.b * 0.5));
        healed.data[idx + 3] = 255;
      }
      transferTexture(healed, original, healMask, {
        offsetX: donor.offsetX,
        offsetY: donor.offsetY,
        amount: 1,
      });
      break;
    }
    case "diffusion":
    default: {
      const ringColor = ringMeanColor(image.data, width, height, healMask);
      const donor = findDonorOffset(image.data, width, height, healMask, ringColor, opts.textureOffset);
      healed = diffusionFill(image, healMask, {
        strength: opts.strength,
        iterations: opts.iterations,
      });
      // Lift the low-frequency difference between the fill and the ring colour
      // so the patch matches the surrounding paper tone exactly.
      for (let p = 0; p < width * height; p++) {
        if (!healMask[p]) continue;
        const idx = p * 4;
        healed.data[idx] = Math.max(0, Math.min(255, healed.data[idx] * 0.55 + ringColor.r * 0.45));
        healed.data[idx + 1] = Math.max(0, Math.min(255, healed.data[idx + 1] * 0.55 + ringColor.g * 0.45));
        healed.data[idx + 2] = Math.max(0, Math.min(255, healed.data[idx + 2] * 0.55 + ringColor.b * 0.45));
        healed.data[idx + 3] = 255;
      }
      transferTexture(healed, original, healMask, {
        offsetX: donor.offsetX,
        offsetY: donor.offsetY,
        amount: 0.9,
      });
      break;
    }
  }

  // Feather the seam: composite healed over original with a soft mask.
  const soft = featherMask(healMask, width, height, Math.max(0, opts.feather));
  const out = new ImageData(width, height);
  for (let p = 0; p < width * height; p++) {
    const idx = p * 4;
    const w = Math.max(0, Math.min(1, soft[p]));
    for (let c = 0; c < 4; c++) {
      out.data[idx + c] = original.data[idx + c] * (1 - w) + healed.data[idx + c] * w;
    }
  }

  return { region: out, mode, analysis, coverage: rawCoverage };
}

/** Convenience for tests + the picker: CSS colour of the detected paper. */
export function paperCss(analysis: HealAnalysis) {
  return rgbCss(analysis.paper);
}
