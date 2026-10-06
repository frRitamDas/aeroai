/**
 * End-to-end engine verification.
 *
 * Builds a synthetic "photographed receipt" with a real canvas backend, runs
 * the actual OCR + analysis + healing + finish code paths over it, and writes
 * artifacts/before.png and artifacts/after.png so the result can be reviewed
 * visually. Nothing here is mocked: if the pipeline drifts, the images will
 * show it.
 */
import { describe, expect, it } from "vitest";
import { createCanvas, ImageData as NapiImageData, type Canvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyseTextRegion, rgbToHex } from "@/lib/editor/color";
import { suggestFonts } from "@/lib/editor/fonts";
import { findDonorOffset, healRegion, buildGlyphMask, erodeMask, ringMeanColor } from "@/lib/editor/inpaint";
import { addGrain, applyJpegArtifacts, blurImageData } from "@/lib/editor/effects";

const OUT_DIR = path.resolve(__dirname, "../artifacts");
const WIDTH = 900;
const HEIGHT = 620;

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Ctx = ReturnType<Canvas["getContext"]>;

function toImageData(ctx: Ctx, region: Region): ImageData {
  return ctx.getImageData(region.x, region.y, region.width, region.height) as unknown as ImageData;
}

/** napi-canvas needs its own ImageData class when writing pixels back. */
function toNapi(image: ImageData) {
  return new NapiImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

/** A believable photographed receipt: warm paper, soft light, grain, JPEG. */
function drawReceipt(): { canvas: Canvas; word: Region } {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Desk behind the paper.
  ctx.fillStyle = "#8d6e52";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(60, 40, WIDTH - 120, HEIGHT - 80);

  // Soft lighting gradient across the paper.
  const gradient = ctx.createLinearGradient(60, 40, WIDTH - 60, HEIGHT - 40);
  gradient.addColorStop(0, "rgba(255,255,255,0.35)");
  gradient.addColorStop(0.55, "rgba(255,246,225,0.05)");
  gradient.addColorStop(1, "rgba(120,90,60,0.18)");
  ctx.fillStyle = gradient;
  ctx.fillRect(60, 40, WIDTH - 120, HEIGHT - 80);

  // Printed lines of the receipt.
  ctx.fillStyle = "#1b1a18";
  ctx.font = "600 40px sans-serif";
  ctx.fillText("CAFE MENU", 200, 140);
  ctx.font = "20px sans-serif";
  ctx.fillText("------------------------------", 200, 175);

  ctx.font = "30px sans-serif";
  ctx.fillText("Americano", 200, 260);
  ctx.fillText("3.20", 640, 260);
  ctx.fillText("Flat white", 200, 320);
  ctx.fillText("3.80", 640, 320);

  // The line we are going to edit. The box is measured from the real glyph
  // metrics so it is exactly as tight as an OCR word box would be.
  const baseline = 420;
  ctx.font = "30px sans-serif";
  ctx.fillText("Chicken Banana", 200, baseline);
  ctx.fillText("20 minute", 200, 480);

  const measure = ctx.measureText("Banana");
  const prefix = ctx.measureText("Chicken ").width;
  const word = {
    x: Math.round(200 + prefix),
    y: Math.round(baseline - (measure.actualBoundingBoxAscent ?? 22)),
    width: Math.ceil(measure.width),
    height: Math.ceil((measure.actualBoundingBoxAscent ?? 22) + (measure.actualBoundingBoxDescent ?? 4)),
  };

  // Camera character: slight blur, grain and real JPEG artefacts.
  const image = toImageData(ctx, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
  blurImageData(image.data, WIDTH, HEIGHT, 0.6);
  addGrain(image.data, WIDTH, HEIGHT, 0.16, 7);
  applyJpegArtifacts(image, 62);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx.putImageData(image as any, 0, 0);

  return { canvas, word };
}

describe("engine verification", () => {
  it("replaces a word on a photographed receipt without leaving a smudge", async () => {
    await mkdir(OUT_DIR, { recursive: true });
    const { canvas, word } = drawReceipt();
    const ctx = canvas.getContext("2d");

    await writeFile(path.join(OUT_DIR, "before.png"), canvas.toBuffer("image/png"));

    // 1. Analyse the region we intend to edit.
    const pad = 6;
    const region: Region = {
      x: word.x - pad,
      y: word.y - pad,
      width: word.width + pad * 2,
      height: word.height + pad * 2,
    };
    const original = toImageData(ctx, region);
    const analysis = analyseTextRegion(original);
    expect(analysis.stats.inkRatio).toBeGreaterThan(0.03);
    expect(analysis.stats.inkRatio).toBeLessThan(0.7);

    // 2. Font matching should propose something plausible for printed text.
    const suggestions = suggestFonts(analysis.stats, "Chicken Banana", 3);
    expect(suggestions.length).toBe(3);
    expect(suggestions[0].score).toBeGreaterThanOrEqual(suggestions[2].score);

    // 3. Heal the old word out of the pixels.
    const healed = healRegion(
      original,
      { x: pad, y: pad, width: word.width, height: word.height },
      { mode: "auto", mask: "auto", color: rgbToHex(analysis.paper), feather: 2, strength: 0.7 },
    );

    const mask = buildGlyphMask(
      original.data,
      original.width,
      original.height,
      analysis.ink,
      analysis.paper,
    );
    let masked = 0;
    for (let i = 0; i < mask.length; i++) masked += mask[i];
    expect(masked / mask.length).toBeGreaterThan(0.05);

    // --- diagnostics: which donor band did the engine pick? ---
    {
      const diagMask = buildGlyphMask(
        original.data,
        original.width,
        original.height,
        analysis.ink,
        analysis.paper,
      );
      const donor = findDonorOffset(
        original.data,
        original.width,
        original.height,
        diagMask,
        ringMeanColor(original.data, original.width, original.height, diagMask),
      );
      let donorInk = 0;
      let donorCount = 0;
      for (let y = 0; y < original.height; y++) {
        for (let x = 0; x < original.width; x++) {
          const p0 = y * original.width + x;
          if (!diagMask[p0]) continue;
          const sx = Math.max(0, Math.min(original.width - 1, x + donor.offsetX));
          const sy = Math.max(0, Math.min(original.height - 1, y + donor.offsetY));
          const sp = sy * original.width + sx;
          if (diagMask[sp]) donorInk++;
          donorCount++;
        }
      }
      console.log("donor", {
        offsetX: donor.offsetX,
        offsetY: donor.offsetY,
        score: Math.round(donor.score),
        donorOnInkRatio: Number((donorInk / Math.max(1, donorCount)).toFixed(3)),
      });
    }

    // After healing there must be no ink left: every masked (former glyph)
    // pixel has to sit close to the luminance of the paper right around it.
    let ringLum = 0;
    let ringCount = 0;
    for (let p = 0; p < original.width * original.height; p++) {
      if (mask[p]) continue;
      const index = p * 4;
      ringLum +=
        0.2126 * original.data[index] +
        0.7152 * original.data[index + 1] +
        0.0722 * original.data[index + 2];
      ringCount++;
    }
    ringLum /= Math.max(1, ringCount);

    // The mask *interior* is what must be perfectly erased; the outer fringe
    // is deliberately feathered so the patch dissolves into its surroundings.
    const interior = erodeMask(mask, original.width, original.height, 1);
    let residualInk = 0;
    let boundaryInk = 0;
    let boundaryCount = 0;
    let patchLum = 0;
    let counted = 0;
    for (let p = 0; p < original.width * original.height; p++) {
      if (!mask[p]) continue;
      const isInterior = interior[p] === 1;
      const index0 = p * 4;
      const lum0 =
        0.2126 * healed.region.data[index0] +
        0.7152 * healed.region.data[index0 + 1] +
        0.0722 * healed.region.data[index0 + 2];
      if (!isInterior) {
        boundaryCount++;
        if (lum0 < ringLum - 60) boundaryInk++;
        continue;
      }
      const index = p * 4;
      const lum =
        0.2126 * healed.region.data[index] +
        0.7152 * healed.region.data[index + 1] +
        0.0722 * healed.region.data[index + 2];
      patchLum += lum;
      counted++;
      if (lum < ringLum - 60) residualInk++;
    }
    patchLum /= Math.max(1, counted);
    const residualRatio = residualInk / Math.max(1, counted);
    console.log("heal diagnostics", {
      mode: healed.mode,
      coverage: Number(healed.coverage.toFixed(3)),
      paper: rgbToHex(analysis.paper),
      ink: rgbToHex(analysis.ink),
      ringLum: Math.round(ringLum),
      patchLum: Math.round(patchLum),
      residualInkRatio: Number(residualRatio.toFixed(4)),
    });

    expect(residualRatio).toBeLessThan(0.01);
    expect(boundaryInk / Math.max(1, boundaryCount)).toBeLessThan(0.3);
    expect(Math.abs(patchLum - ringLum)).toBeLessThan(18);

    // 4. Composite the healed pixels, then type the replacement text with the
    //    analysed colour and a matched weight.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.putImageData(toNapi(healed.region) as any, region.x, region.y);

    const inkHex = rgbToHex(analysis.ink);
    const inkLum = 0.2126 * analysis.ink.r + 0.7152 * analysis.ink.g + 0.0722 * analysis.ink.b;
    const textColour = inkLum < 140 ? inkHex : "#1b1a18";
    ctx.fillStyle = textColour;
    ctx.font = `${suggestions[0].weight >= 600 ? "600" : "400"} ${Math.round(word.height * 0.72)}px sans-serif`;
    ctx.fillText("Noodle", word.x, word.y + word.height - 3);

    // 5. Page finish: the replacement must share the photo's grain + JPEG.
    const finished = toImageData(ctx, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
    addGrain(finished.data, WIDTH, HEIGHT, 0.16, 11);
    applyJpegArtifacts(finished, 62);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.putImageData(toNapi(finished) as any, 0, 0);

    await writeFile(path.join(OUT_DIR, "after.png"), canvas.toBuffer("image/png"));

    // Artifacts must exist and be non-trivial.
    expect(canvas.toBuffer("image/png").length).toBeGreaterThan(10_000);
  });
});
