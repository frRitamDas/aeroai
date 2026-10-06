import { seededRandom } from "@/lib/utils";

/**
 * Photographic finish: grain, softness, ink spread and a real DCT based JPEG
 * simulation. All of these are pure functions over `ImageData` so they can be
 * unit tested in Node and reused for both preview and export.
 */

/** Separable box blur over RGBA (premultiplied-safe enough for our glyph bitmaps). */
export function blurImageData(data: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (radius < 0.5) return;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Uint8ClampedArray(data.length);
  const pass = (src: Uint8ClampedArray, dst: Uint8ClampedArray, horizontal: boolean) => {
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;
    for (let o = 0; o < outer; o++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;
      let count = 0;
      // Prime the running window.
      for (let i = -r; i <= r; i++) {
        const idx = horizontal ? (o * width + Math.min(inner - 1, Math.max(0, i))) * 4 : (Math.min(inner - 1, Math.max(0, i)) * width + o) * 4;
        sumR += src[idx];
        sumG += src[idx + 1];
        sumB += src[idx + 2];
        sumA += src[idx + 3];
        count++;
      }
      for (let i = 0; i < inner; i++) {
        const outIdx = horizontal ? (o * width + i) * 4 : (i * width + o) * 4;
        dst[outIdx] = sumR / count;
        dst[outIdx + 1] = sumG / count;
        dst[outIdx + 2] = sumB / count;
        dst[outIdx + 3] = sumA / count;
        const addIdx = horizontal
          ? (o * width + Math.min(inner - 1, i + r + 1)) * 4
          : (Math.min(inner - 1, i + r + 1) * width + o) * 4;
        const subIdx = horizontal
          ? (o * width + Math.max(0, i - r)) * 4
          : (Math.max(0, i - r) * width + o) * 4;
        sumR += src[addIdx] - src[subIdx];
        sumG += src[addIdx + 1] - src[subIdx + 1];
        sumB += src[addIdx + 2] - src[subIdx + 2];
        sumA += src[addIdx + 3] - src[subIdx + 3];
      }
    }
  };
  pass(data, tmp, true);
  pass(tmp, data, false);
}

/** Soft bloom around existing ink — mimics how ink bleeds into paper. */
export function inkSpread(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (amount <= 0.001) return;
  const radius = 0.4 + amount * 1.6;
  const copy = new Uint8ClampedArray(data);
  blurImageData(copy, width, height, radius);
  const strength = Math.min(1, 0.35 + amount * 0.6);
  for (let i = 0; i < data.length; i += 4) {
    const a = (copy[i + 3] / 255) * strength;
    if (a <= 0.002) continue;
    data[i] = data[i] * (1 - a) + copy[i] * a;
    data[i + 1] = data[i + 1] * (1 - a) + copy[i + 1] * a;
    data[i + 2] = data[i + 2] * (1 - a) + copy[i + 2] * a;
    data[i + 3] = Math.min(255, data[i + 3] + (copy[i + 3] - data[i + 3]) * a);
  }
}

/** Slight alpha feathering so replacement glyphs sit "in" the paper. */
export function featherAlpha(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (amount <= 0.001) return;
  const radius = 0.5 + amount * 2.2;
  const copy = new Uint8ClampedArray(data);
  blurImageData(copy, width, height, radius);
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] * (1 - amount) + copy[i] * amount;
  }
}

/** Monochrome film/paper grain, alpha aware. */
export function addGrain(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  seed = 1,
) {
  if (amount <= 0.001) return;
  const rand = seededRandom(seed);
  const scale = amount * 26;
  // Two octaves: fine sensor noise + a coarser paper texture.
  const coarseW = Math.max(2, Math.ceil(width / 3));
  const coarseH = Math.max(2, Math.ceil(height / 3));
  const coarse = new Float32Array(coarseW * coarseH);
  for (let i = 0; i < coarse.length; i++) coarse[i] = (rand() * 2 - 1) * scale * 0.6;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] < 8) continue;
      const cx = Math.min(coarseW - 1, (x / width) * coarseW) | 0;
      const cy = Math.min(coarseH - 1, (y / height) * coarseH) | 0;
      const n = (rand() * 2 - 1) * scale + coarse[cy * coarseW + cx];
      data[idx] = Math.max(0, Math.min(255, data[idx] + n));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + n));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + n));
    }
  }
}

// ---------------------------------------------------------------------------
// JPEG simulation (8x8 DCT, quantisation tables from the JPEG standard with
// 4:2:0 chroma subsampling). Reproduces the ringing artefacts you get when a
// photo is saved as a compressed JPEG — the giveaway that a text edit is fake
// when it is missing.
// ---------------------------------------------------------------------------

const LUMA_QUANT = [
  16, 11, 10, 16, 24, 40, 51, 61,
  12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77,
  24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];

const CHROMA_QUANT = [
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
];

const DCT_TABLE: number[][] = (() => {
  const table: number[][] = [];
  for (let u = 0; u < 8; u++) {
    const row: number[] = [];
    for (let x = 0; x < 8; x++) {
      row.push(Math.cos(((2 * x + 1) * u * Math.PI) / 16) * (u === 0 ? Math.SQRT1_2 : 1));
    }
    table.push(row);
  }
  return table;
})();

function scaleQuantTable(table: number[], qualityPercent: number): number[] {
  const q = Math.max(1, Math.min(100, qualityPercent));
  const scale = q < 50 ? 5000 / q : 200 - q * 2;
  return table.map((value) => Math.max(1, Math.min(255, Math.floor((value * scale + 50) / 100))));
}

/** 2D DCT-II + quantisation + inverse, in place on an 8x8 block. */
function processBlock(block: Float32Array, quant: number[], scratch: Float32Array) {
  // Rows
  for (let y = 0; y < 8; y++) {
    for (let u = 0; u < 8; u++) {
      let sum = 0;
      for (let x = 0; x < 8; x++) sum += block[y * 8 + x] * DCT_TABLE[u][x];
      scratch[y * 8 + u] = sum * 0.5;
    }
  }
  // Columns + quantise
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let y = 0; y < 8; y++) sum += scratch[y * 8 + u] * DCT_TABLE[v][y];
      const coeff = sum * 0.5;
      const q = quant[v * 8 + u];
      block[v * 8 + u] = Math.round(coeff / q) * q;
    }
  }
  // Inverse rows
  for (let v = 0; v < 8; v++) {
    for (let x = 0; x < 8; x++) {
      let sum = 0;
      for (let u = 0; u < 8; u++) {
        sum += (u === 0 ? Math.SQRT1_2 : 1) * block[v * 8 + u] * DCT_TABLE[u][x];
      }
      scratch[v * 8 + x] = sum * 0.5;
    }
  }
  // Inverse columns
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let sum = 0;
      for (let v = 0; v < 8; v++) {
        sum += (v === 0 ? Math.SQRT1_2 : 1) * scratch[v * 8 + x] * DCT_TABLE[v][y];
      }
      block[y * 8 + x] = sum * 0.5;
    }
  }
}

/**
 * Simulate JPEG compression artifacts.
 * @param quality 1..100 (lower = more artifacts)
 */
export function applyJpegArtifacts(
  image: ImageData,
  quality = 60,
  options: { chromaSubsample?: boolean } = {},
) {
  const { width, height, data } = image;
  const lumaQuant = scaleQuantTable(LUMA_QUANT, quality);
  const chromaQuant = scaleQuantTable(CHROMA_QUANT, quality);
  const block = new Float32Array(64);
  const scratch = new Float32Array(64);

  const yPlane = new Float32Array(width * height);
  const cbPlane = new Float32Array(((width + 1) >> 1) * ((height + 1) >> 1));
  const crPlane = new Float32Array(cbPlane.length);
  const alphaPlane = new Float32Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    yPlane[p] = (0.299 * r + 0.587 * g + 0.114 * b) * 255 - 128;
    alphaPlane[p] = data[i + 3];
    if (options.chromaSubsample !== false) {
      const x = p % width;
      const y = (p / width) | 0;
      const ci = ((y >> 1) * ((width + 1) >> 1)) + (x >> 1);
      cbPlane[ci] += ((128 - 0.168736 * data[i] - 0.331264 * data[i + 1] + 0.5 * data[i + 2]) - 128) / 4;
      crPlane[ci] += ((128 + 0.5 * data[i] - 0.418688 * data[i + 1] - 0.081312 * data[i + 2]) - 128) / 4;
    }
  }

  const runPlane = (plane: Float32Array, planeWidth: number, planeHeight: number, quant: number[]) => {
    for (let by = 0; by < planeHeight; by += 8) {
      for (let bx = 0; bx < planeWidth; bx += 8) {
        let hasContent = false;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const px = Math.min(planeWidth - 1, bx + x);
            const py = Math.min(planeHeight - 1, by + y);
            const value = plane[py * planeWidth + px];
            block[y * 8 + x] = value;
            if (Math.abs(value) > 0.5) hasContent = true;
          }
        }
        if (!hasContent) continue;
        processBlock(block, quant, scratch);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const px = Math.min(planeWidth - 1, bx + x);
            const py = Math.min(planeHeight - 1, by + y);
            plane[py * planeWidth + px] = block[y * 8 + x];
          }
        }
      }
    }
  };

  runPlane(yPlane, width, height, lumaQuant);
  const cw = (width + 1) >> 1;
  const ch = (height + 1) >> 1;
  runPlane(cbPlane, cw, ch, chromaQuant);
  runPlane(crPlane, cw, ch, chromaQuant);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const idx = p * 4;
      const ci = (y >> 1) * cw + (x >> 1);
      const yy = (yPlane[p] + 128) / 255;
      const cb = (cbPlane[ci] + 128 - 128) / 255;
      const cr = (crPlane[ci] + 128 - 128) / 255;
      const r = yy + 1.402 * cr;
      const g = yy - 0.344136 * cb - 0.714136 * cr;
      const b = yy + 1.772 * cb;
      data[idx] = Math.max(0, Math.min(255, r * 255));
      data[idx + 1] = Math.max(0, Math.min(255, g * 255));
      data[idx + 2] = Math.max(0, Math.min(255, b * 255));
      data[idx + 3] = alphaPlane[p];
    }
  }
}

/**
 * "Scan quality": a cheap camera/scan model — slight resolution loss, tone
 * curve and colour cast. `quality` 0 = pristine digital, 1 = bad phone photo.
 */
export function applyScanQuality(
  image: ImageData,
  quality: number,
  options: { tone?: number; cast?: number } = {},
) {
  const q = Math.max(0, Math.min(1, quality));
  if (q <= 0.001) return;
  const { width, height, data } = image;

  // 1. Resolution loss, re-upsampled with smoothing.
  if (q > 0.15) {
    const scale = 1 - q * 0.45;
    const smallW = Math.max(2, Math.round(width * scale));
    const smallH = Math.max(2, Math.round(height * scale));
    const small = new Float32Array(smallW * smallH * 4);
    for (let y = 0; y < smallH; y++) {
      for (let x = 0; x < smallW; x++) {
        const sx = Math.min(width - 1, Math.round((x / smallW) * width));
        const sy = Math.min(height - 1, Math.round((y / smallH) * height));
        const s = (sy * width + sx) * 4;
        const d = (y * smallW + x) * 4;
        small[d] = data[s];
        small[d + 1] = data[s + 1];
        small[d + 2] = data[s + 2];
        small[d + 3] = data[s + 3];
      }
    }
    for (let y = 0; y < height; y++) {
      const fy = (y / height) * (smallH - 1);
      const y0 = Math.floor(fy);
      const y1 = Math.min(smallH - 1, y0 + 1);
      const ty = fy - y0;
      for (let x = 0; x < width; x++) {
        const fx = (x / width) * (smallW - 1);
        const x0 = Math.floor(fx);
        const x1 = Math.min(smallW - 1, x0 + 1);
        const tx = fx - x0;
        const d = (y * width + x) * 4;
        for (let c = 0; c < 4; c++) {
          const a = small[(y0 * smallW + x0) * 4 + c];
          const b = small[(y0 * smallW + x1) * 4 + c];
          const e = small[(y1 * smallW + x0) * 4 + c];
          const f = small[(y1 * smallW + x1) * 4 + c];
          data[d + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (e * (1 - tx) + f * tx) * ty;
        }
      }
    }
  }

  // 2. Tone curve + slight warm cast, typical of consumer scans.
  const cast = options.cast ?? q;
  const lift = q * 0.04;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    data[i] = Math.min(255, data[i] * (1 - lift) + 255 * lift + cast * 6);
    data[i + 1] = Math.min(255, data[i + 1] * (1 - lift * 0.6) + 255 * lift * 0.6 + cast * 2);
    data[i + 2] = Math.min(255, data[i + 2] * (1 - lift * 0.4) + 255 * lift * 0.4 - cast * 4);
  }
}

/** Per-glyph toner variation is applied while painting text, see render.ts. */
export function jitterAlpha(alpha: number, amount: number, random: () => number) {
  if (amount <= 0.001) return alpha;
  const jitter = 1 - amount * random() * 0.9;
  return Math.max(0, Math.min(1, alpha * jitter));
}
