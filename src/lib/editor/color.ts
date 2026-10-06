import type { TextStats } from "./types";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const int = parseInt(full || "000000", 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbCss({ r, g, b }: Rgb, a = 1): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return a >= 1 ? `rgb(${to(r)}, ${to(g)}, ${to(b)})` : `rgba(${to(r)}, ${to(g)}, ${to(b)}, ${a})`;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function readableTextColor(background: Rgb): string {
  return contrastRatio(background, { r: 255, g: 255, b: 255 }) >= 3 ? "#ffffff" : "#111111";
}

export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Two-means clustering (k-means with k=2, deterministic seeding) over the
 * pixels of a text region. Produces the ink colour and the paper colour —
 * this is what powers "match the original text colour" and the automatic
 * background patch colour.
 */
export function clusterForegroundBackground(
  data: Uint8ClampedArray,
  alphaThreshold = 16,
): { fg: Rgb; bg: Rgb; fgRatio: number } {
  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < alphaThreshold) continue;
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  if (pixels.length === 0) {
    return { fg: { r: 0, g: 0, b: 0 }, bg: { r: 255, g: 255, b: 255 }, fgRatio: 0 };
  }

  // Seed with the extremes of the luminance histogram (darkest / brightest).
  let dark = pixels[0];
  let bright = pixels[0];
  let darkLum = relativeLuminance(dark);
  let brightLum = darkLum;
  for (const p of pixels) {
    const l = relativeLuminance(p);
    if (l < darkLum) {
      darkLum = l;
      dark = p;
    }
    if (l > brightLum) {
      brightLum = l;
      bright = p;
    }
  }
  let cA: Rgb = { ...dark };
  let cB: Rgb = { ...bright };

  for (let iteration = 0; iteration < 12; iteration++) {
    const sumA = { r: 0, g: 0, b: 0, n: 0 };
    const sumB = { r: 0, g: 0, b: 0, n: 0 };
    for (const p of pixels) {
      if (colorDistance(p, cA) <= colorDistance(p, cB)) {
        sumA.r += p.r;
        sumA.g += p.g;
        sumA.b += p.b;
        sumA.n++;
      } else {
        sumB.r += p.r;
        sumB.g += p.g;
        sumB.b += p.b;
        sumB.n++;
      }
    }
    if (!sumA.n || !sumB.n) break;
    const nextA = { r: sumA.r / sumA.n, g: sumA.g / sumA.n, b: sumA.b / sumA.n };
    const nextB = { r: sumB.r / sumB.n, g: sumB.g / sumB.n, b: sumB.b / sumB.n };
    const settled =
      colorDistance(nextA, cA) + colorDistance(nextB, cB) < 0.6;
    cA = nextA;
    cB = nextB;
    if (settled) break;
  }

  // The least frequent cluster is normally the ink.
  let fgCount = 0;
  for (const p of pixels) {
    if (colorDistance(p, cA) <= colorDistance(p, cB)) fgCount++;
  }
  const fg = fgCount / pixels.length < 0.5 ? cA : cB;
  const bg = fg === cA ? cB : cA;
  return {
    fg,
    bg,
    fgRatio: Math.min(fgCount, pixels.length - fgCount) / pixels.length,
  };
}

export interface RegionStats {
  ink: Rgb;
  paper: Rgb;
  inkRatio: number;
  strokeRatio: number;
  slant: number;
  serifScore: number;
  xHeightRatio: number;
  meanLuminance: number;
  variance: number;
}

/**
 * Structural analysis of a cropped text region. Everything here is a
 * heuristic — the UI is explicit about that — but combined they are good
 * enough to preselect a convincing font/weight/italic and to pick the
 * right background-heal strategy.
 */
export function analyseTextRegion(image: ImageData): {
  stats: TextStats;
  ink: Rgb;
  paper: Rgb;
  full: RegionStats;
} {
  const { width, height, data } = image;
  const { fg, bg, fgRatio } = clusterForegroundBackground(data);

  const bgLum = relativeLuminance(bg);
  const fgLum = relativeLuminance(fg);
  const dark = fgLum < bgLum;
  const inkLum = dark ? fgLum : bgLum;
  const paperLum = dark ? bgLum : fgLum;

  // Ink mask: pixels close to the ink cluster, or simply darker than the midpoint.
  const threshold = (inkLum + paperLum) / 2;
  const mask = new Uint8Array(width * height);
  // A near-uniform crop (blank paper, empty margin, flat colour) has no ink at
  // all — without this guard the threshold trick would mark every pixel as ink.
  const separation = Math.abs(paperLum - inkLum);
  const hasInk = separation > 0.06;
  let inkCount = 0;
  let lumSum = 0;
  let lumSqSum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum =
      0.2126 * (data[i] / 255) + 0.7152 * (data[i + 1] / 255) + 0.0722 * (data[i + 2] / 255);
    lumSum += lum;
    lumSqSum += lum * lum;
    const isInk = hasInk && (dark ? lum < threshold : lum > threshold);
    if (isInk && data[i + 3] > 24) {
      mask[p] = 1;
      inkCount++;
    }
  }
  const total = width * height;
  const inkRatio = total ? inkCount / total : 0;
  const meanLuminance = total ? lumSum / total : 0;
  const variance = Math.max(0, (total ? lumSqSum / total : 0) - meanLuminance ** 2);

  // Row/column projections give us stroke thickness and a slant estimate.
  const rowInk = new Float32Array(height);
  const colInk = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        rowInk[y]++;
        colInk[x]++;
      }
    }
  }
  let rowMin = 0;
  let rowMax = height - 1;
  while (rowMin < height && rowInk[rowMin] === 0) rowMin++;
  while (rowMax > rowMin && rowInk[rowMax] === 0) rowMax--;
  const textHeight = Math.max(1, rowMax - rowMin + 1);

  // Mean horizontal run length inside the text band ≈ stroke width.
  let runCount = 0;
  let runTotal = 0;
  const runWidths: number[] = [];
  for (let y = rowMin; y <= rowMax; y++) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        run++;
      } else if (run > 0) {
        runCount++;
        runTotal += run;
        runWidths.push(run);
        run = 0;
      }
    }
    if (run > 0) {
      runCount++;
      runTotal += run;
      runWidths.push(run);
    }
  }
  const meanRun = runCount ? runTotal / runCount : 1;
  const medianRun = runWidths.length
    ? runWidths.slice().sort((a, b) => a - b)[Math.floor(runWidths.length / 2)]
    : 1;

  // Vertical run length gives an independent stroke thickness (better for
  // thin horizontal strokes) — we blend both for robustness.
  let vRunTotal = 0;
  let vRunCount = 0;
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let y = 0; y < height; y++) {
      if (mask[y * width + x]) run++;
      else if (run > 0) {
        vRunTotal += run;
        vRunCount++;
        run = 0;
      }
    }
    if (run > 0) {
      vRunTotal += run;
      vRunCount++;
    }
  }
  const meanVRun = vRunCount ? vRunTotal / vRunCount : 1;
  const strokePx = (medianRun * 0.65 + meanVRun * 0.35) || meanRun;
  const strokeRatio = strokePx / textHeight;

  // Slant: compare the ink centroid of the top half vs bottom half of the band.
  let topSum = 0;
  let topCount = 0;
  let bottomSum = 0;
  let bottomCount = 0;
  const mid = rowMin + (rowMax - rowMin) / 2;
  for (let y = rowMin; y <= rowMax; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (y < mid) {
        topSum += x;
        topCount++;
      } else {
        bottomSum += x;
        bottomCount++;
      }
    }
  }
  const topCentroid = topCount ? topSum / topCount : 0;
  const bottomCentroid = bottomCount ? bottomSum / bottomCount : 0;
  const slant = topCount && bottomCount ? Math.atan2(topCentroid - bottomCentroid, textHeight) * (180 / Math.PI) : 0;

  // Serif flare: rows near the baseline that are much wider than the average
  // row ink — a decent proxy for foot serifs.
  let flareRows = 0;
  const baselineBand = Math.max(1, Math.round(textHeight * 0.12));
  for (let y = rowMax - baselineBand; y <= rowMax; y++) {
    if (y < 0) continue;
    if (rowInk[y] > colInk.length * 0.02 && rowInk[y] > (inkCount / textHeight) * 1.55) flareRows++;
  }
  const serifScore = Math.max(0, Math.min(1, flareRows / baselineBand));

  // x-height proxy: median row ink peak position.
  let peakRow = rowMin;
  let peak = -1;
  for (let y = rowMin; y <= rowMax; y++) {
    if (rowInk[y] > peak) {
      peak = rowInk[y];
      peakRow = y;
    }
  }
  const xHeightRatio = textHeight ? (peakRow - rowMin) / textHeight || 0.5 : 0.5;

  const stats: TextStats = {
    inkRatio,
    strokeRatio,
    slant,
    serifScore,
    xHeightRatio: Math.max(0.3, Math.min(1, xHeightRatio)),
  };

  return {
    stats,
    ink: fg,
    paper: bg,
    full: {
      ink: fg,
      paper: bg,
      inkRatio: fgRatio,
      strokeRatio,
      slant,
      serifScore,
      xHeightRatio: stats.xHeightRatio,
      meanLuminance,
      variance,
    },
  };
}

/** Mean colour of an ImageData region, alpha weighted. */
export function meanColor(data: Uint8ClampedArray): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a <= 0.02) continue;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    n += a;
  }
  if (!n) return { r: 255, g: 255, b: 255 };
  return { r: r / n, g: g / n, b: b / n };
}

export function luminanceVariance(data: Uint8ClampedArray): number {
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += lum;
    sq += lum * lum;
    n++;
  }
  if (!n) return 0;
  const mean = sum / n;
  return Math.max(0, sq / n - mean * mean);
}
