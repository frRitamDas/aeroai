import { describe, expect, it } from "vitest";
import {
  addGrain,
  applyJpegArtifacts,
  applyScanQuality,
  blurImageData,
  featherAlpha,
  inkSpread,
  jitterAlpha,
} from "./effects";
import { seededRandom } from "@/lib/utils";

function makeImage(width: number, height: number, paint: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

const checker = () =>
  makeImage(32, 32, (x, y) => {
    const on = (x % 8 < 4) !== (y % 8 < 4);
    return on ? [20, 20, 20] : [240, 240, 240];
  });

describe("blurImageData", () => {
  it("reduces local contrast", () => {
    const image = checker();
    const contrast = (data: Uint8ClampedArray) => {
      let sum = 0;
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 31; x++) {
          sum += Math.abs(data[(y * 32 + x) * 4] - data[(y * 32 + x + 1) * 4]);
        }
      }
      return sum;
    };
    const before = contrast(image.data);
    blurImageData(image.data, image.width, image.height, 3);
    expect(contrast(image.data)).toBeLessThan(before * 0.6);
  });

  it("is a no-op for radius < 0.5", () => {
    const image = checker();
    const copy = new Uint8ClampedArray(image.data);
    blurImageData(image.data, image.width, image.height, 0.2);
    expect(Array.from(image.data)).toEqual(Array.from(copy));
  });
});

describe("addGrain", () => {
  it("is deterministic for a given seed and changes pixels", () => {
    const a = checker();
    const b = checker();
    addGrain(a.data, 32, 32, 0.6, 42);
    addGrain(b.data, 32, 32, 0.6, 42);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));

    const c = checker();
    addGrain(c.data, 32, 32, 0.6, 43);
    expect(Array.from(a.data)).not.toEqual(Array.from(c.data));
  });

  it("leaves fully transparent pixels alone", () => {
    const image = makeImage(8, 8, () => [0, 0, 0, 0]);
    addGrain(image.data, 8, 8, 1, 1);
    expect(Array.from(image.data).every((value) => value === 0)).toBe(true);
  });
});

describe("applyJpegArtifacts", () => {
  it("keeps dimensions, alpha and produces the expected blocky ringing", () => {
    const image = checker();
    const originalAlpha = Array.from(image.data.filter((_, index) => index % 4 === 3));
    applyJpegArtifacts(image, 25);
    const alpha = Array.from(image.data.filter((_, index) => index % 4 === 3));
    expect(alpha).toEqual(originalAlpha);

    // Low quality must smear the pristine checkerboard (values leave 20/240).
    const distinct = new Set<number>();
    for (let i = 0; i < image.data.length; i += 4) distinct.add(image.data[i]);
    expect(distinct.size).toBeGreaterThan(2);

    // 8×8 block structure: pixel 7 and pixel 8 of a row differ across blocks.
    expect(image.data[7 * 4]).not.toBe(image.data[8 * 4]);
  });

  it("distorts high quality output far less than low quality output", () => {
    const source = checker();
    const high = new Uint8ClampedArray(source.data);
    const low = new Uint8ClampedArray(source.data);
    const highImage = { ...source, data: high } as ImageData;
    const lowImage = { ...source, data: low } as ImageData;
    applyJpegArtifacts(highImage, 95);
    applyJpegArtifacts(lowImage, 15);
    const error = (data: Uint8ClampedArray) => {
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += Math.abs(data[i] - source.data[i]);
      return sum / (data.length / 4);
    };
    expect(error(high)).toBeLessThan(error(low));
  });

  it("is a no-op when quality is 100 on a flat image", () => {
    const flat = makeImage(16, 16, () => [128, 128, 128]);
    applyJpegArtifacts(flat, 100);
    expect(Math.abs(flat.data[0] - 128)).toBeLessThanOrEqual(1);
  });
});

describe("applyScanQuality", () => {
  it("lifts blacks and warms the tone", () => {
    const image = makeImage(24, 24, () => [0, 0, 0]);
    applyScanQuality(image, 0.8);
    expect(image.data[0]).toBeGreaterThan(0);
    expect(image.data[0]).toBeGreaterThan(image.data[2]);
  });

  it("does nothing at quality 0", () => {
    const image = checker();
    const copy = new Uint8ClampedArray(image.data);
    applyScanQuality(image, 0);
    expect(Array.from(image.data)).toEqual(Array.from(copy));
  });
});

describe("inkSpread and featherAlpha", () => {
  it("bleeds ink into neighbouring pixels", () => {
    const image = makeImage(24, 24, (x) => (x === 12 ? [0, 0, 0] : [255, 255, 255]));
    inkSpread(image.data, 24, 24, 0.8);
    expect(image.data[11 * 4]).toBeLessThan(255);
    expect(image.data[13 * 4]).toBeLessThan(255);
  });

  it("softens alpha edges", () => {
    const image = makeImage(16, 1, (x) => [0, 0, 0, x < 8 ? 255 : 0]);
    featherAlpha(image.data, 16, 1, 0.9);
    expect(image.data[7 * 4 + 3]).toBeLessThan(255);
    expect(image.data[8 * 4 + 3]).toBeGreaterThan(0);
  });
});

describe("jitterAlpha", () => {
  it("never exceeds 1 and gets weaker with smaller amounts", () => {
    const random = seededRandom(3);
    for (let i = 0; i < 50; i++) {
      const value = jitterAlpha(1, 0.5, random);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(jitterAlpha(1, 0, seededRandom(1))).toBe(1);
  });
});
