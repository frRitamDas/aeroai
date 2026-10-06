import { describe, expect, it } from "vitest";
import {
  analyseTextRegion,
  clusterForegroundBackground,
  colorDistance,
  contrastRatio,
  hexToRgb,
  meanColor,
  readableTextColor,
  rgbToHex,
} from "./color";

function imageDataFrom(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

/** Black letters on white paper: 4 vertical strokes. */
function textLikeImage(): ImageData {
  return imageDataFrom(80, 24, (x, y) => {
    const stroke = Math.floor(x / 10) % 2 === 0 && y > 3 && y < 21;
    return stroke ? [10, 10, 12, 255] : [246, 245, 240, 255];
  });
}

describe("colour helpers", () => {
  it("round-trips hex through rgb", () => {
    expect(rgbToHex(hexToRgb("#ff8800"))).toBe("#ff8800");
    expect(rgbToHex(hexToRgb("#abc"))).toBe("#aabbcc");
  });

  it("computes contrast and readable text colours", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeGreaterThan(20);
    expect(readableTextColor({ r: 20, g: 20, b: 20 })).toBe("#ffffff");
    expect(readableTextColor({ r: 245, g: 245, b: 245 })).toBe("#111111");
  });

  it("splits ink from paper with two-means clustering", () => {
    const image = textLikeImage();
    const { fg, bg, fgRatio } = clusterForegroundBackground(image.data);
    expect(fg.r).toBeLessThan(60);
    expect(bg.r).toBeGreaterThan(200);
    expect(fgRatio).toBeGreaterThan(0.1);
    expect(fgRatio).toBeLessThan(0.6);
    expect(colorDistance(fg, bg)).toBeGreaterThan(120);
  });

  it("falls back gracefully on empty input", () => {
    const empty = new Uint8ClampedArray(8);
    const { fg, bg } = clusterForegroundBackground(empty);
    expect(fg).toEqual({ r: 0, g: 0, b: 0 });
    expect(bg).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("averages colours weighted by alpha", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]);
    expect(meanColor(data)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("analyseTextRegion", () => {
  it("measures ink ratio, stroke weight and serif score", () => {
    const image = textLikeImage();
    const { stats, ink, paper } = analyseTextRegion(image);
    expect(ink.r).toBeLessThan(80);
    expect(paper.r).toBeGreaterThan(200);
    expect(stats.inkRatio).toBeGreaterThan(0.2);
    expect(stats.inkRatio).toBeLessThan(0.5);
    expect(stats.strokeRatio).toBeGreaterThan(0.1);
    expect(stats.strokeRatio).toBeLessThan(1);
    expect(stats.serifScore).toBeGreaterThanOrEqual(0);
    expect(stats.xHeightRatio).toBeGreaterThanOrEqual(0.3);
  });

  it("detects slant on a sheared pattern", () => {
    const upright = imageDataFrom(60, 30, (x, y) => ((y > 4 && y < 26 && x % 12 < 4) ? [20, 20, 20, 255] : [250, 250, 250, 255]));
    const slanted = imageDataFrom(60, 30, (x, y) => {
      const shifted = (x + Math.round((y - 15) * 0.6)) % 12;
      return y > 4 && y < 26 && shifted < 4 ? [20, 20, 20, 255] : [250, 250, 250, 255];
    });
    const uprightSlant = Math.abs(analyseTextRegion(upright).stats.slant);
    const slantedSlant = Math.abs(analyseTextRegion(slanted).stats.slant);
    expect(slantedSlant).toBeGreaterThan(uprightSlant);
  });

  it("reports near-zero ink for a blank page", () => {
    const blank = imageDataFrom(40, 40, () => [250, 250, 250, 255]);
    const { stats } = analyseTextRegion(blank);
    expect(stats.inkRatio).toBeLessThan(0.05);
  });
});
