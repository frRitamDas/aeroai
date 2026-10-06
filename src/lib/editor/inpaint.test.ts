import { describe, expect, it } from "vitest";
import {
  analyseHeal,
  buildGlyphMask,
  diffusionFill,
  featherMask,
  findDonorOffset,
  healRegion,
  ringMeanColor,
  ringVariance,
  transferTexture,
} from "./inpaint";

function makeImage(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number?],
) {
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

/** White paper with a black word in the middle band. */
function receiptLike() {
  return makeImage(120, 60, (x, y) => {
    const inWord = y >= 22 && y <= 36 && x >= 30 && x <= 90 && Math.floor((x - 30) / 8) % 2 === 0;
    return inWord ? [15, 15, 18] : [247, 246, 242];
  });
}

describe("glyph mask", () => {
  it("selects ink pixels and skips paper", () => {
    const image = receiptLike();
    const mask = buildGlyphMask(image.data, image.width, image.height, { r: 15, g: 15, b: 18 }, { r: 247, g: 246, b: 242 });
    const inkAt = mask[28 * image.width + 32];
    const paperAt = mask[5 * image.width + 5];
    expect(inkAt).toBe(1);
    expect(paperAt).toBe(0);
  });

  it("ignores fully transparent pixels", () => {
    const image = makeImage(4, 4, () => [0, 0, 0, 0]);
    const mask = buildGlyphMask(image.data, 4, 4, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(Array.from(mask).every((value) => value === 0)).toBe(true);
  });
});

describe("region analysis", () => {
  it("classifies flat paper as flat and textured paper as not flat", () => {
    const flat = receiptLike();
    const flatAnalysis = analyseHeal(flat.data, flat.width, flat.height, {
      x: 25,
      y: 20,
      width: 70,
      height: 18,
    });
    expect(flatAnalysis.flat).toBe(true);
    expect(flatAnalysis.coverage).toBeGreaterThan(0.05);

    const noisy = makeImage(120, 60, (x, y) => {
      const noise = ((x * 13 + y * 7) % 40) - 20;
      const inWord = y >= 22 && y <= 36 && x >= 30 && x <= 90 && Math.floor((x - 30) / 8) % 2 === 0;
      const base = inWord ? 20 : 150;
      return [base + noise, base + noise, base + noise];
    });
    const noisyAnalysis = analyseHeal(noisy.data, noisy.width, noisy.height, {
      x: 25,
      y: 20,
      width: 70,
      height: 18,
    });
    expect(noisyAnalysis.flat).toBe(false);
    expect(noisyAnalysis.textureVariance).toBeGreaterThan(flatAnalysis.textureVariance);
  });

  it("reports the paper colour of the ring", () => {
    const image = receiptLike();
    const mask = buildGlyphMask(image.data, image.width, image.height, { r: 15, g: 15, b: 18 }, { r: 247, g: 246, b: 242 });
    const colour = ringMeanColor(image.data, image.width, image.height, mask);
    expect(colour.r).toBeGreaterThan(230);
    expect(colour.b).toBeGreaterThan(230);
  });

  it("measures halo variance", () => {
    const image = receiptLike();
    const { variance } = ringVariance(image.data, image.width, image.height, {
      x: 25,
      y: 20,
      width: 70,
      height: 18,
    });
    expect(variance).toBeGreaterThanOrEqual(0);
  });
});

describe("donor search", () => {
  it("finds a clean band above a word instead of cloning other glyphs", () => {
    const image = receiptLike();
    const mask = buildGlyphMask(image.data, image.width, image.height, { r: 15, g: 15, b: 18 }, { r: 247, g: 246, b: 242 });
    const donor = findDonorOffset(image.data, image.width, image.height, mask, { r: 247, g: 246, b: 242 });
    expect(donor.offsetY).not.toBe(0);
    expect(Math.abs(donor.offsetY)).toBeGreaterThanOrEqual(3);
    expect(Number.isFinite(donor.score)).toBe(true);
  });

  it("honours a manual offset", () => {
    const image = receiptLike();
    const mask = new Uint8Array(image.width * image.height);
    const donor = findDonorOffset(image.data, image.width, image.height, mask, { r: 255, g: 255, b: 255 }, 27);
    expect(donor.offsetY).toBe(27);
    expect(donor.offsetX).toBe(0);
  });
});

describe("diffusion fill", () => {
  it("replaces masked pixels with a smoothed background estimate", () => {
    const image = receiptLike();
    const mask = buildGlyphMask(image.data, image.width, image.height, { r: 15, g: 15, b: 18 }, { r: 247, g: 246, b: 242 });
    const filled = diffusionFill(image, mask, { iterations: 40, strength: 0.8 });
    const index = (28 * image.width + 32) * 4;
    expect(filled.data[index]).toBeGreaterThan(180);
    expect(image.data[index]).toBeLessThan(60); // source untouched
    expect(filled.data[index + 3]).toBe(255);
  });
});

describe("texture transfer", () => {
  it("copies high-frequency detail from the donor offset", () => {
    const base = makeImage(32, 32, () => [200, 200, 200]);
    const source = makeImage(32, 32, (x, y) => {
      const dot = (x + y) % 4 === 0 ? 40 : 0;
      return [200 - dot, 200 - dot, 200 - dot];
    });
    const healed = new ImageData(new Uint8ClampedArray(base.data), 32, 32);
    const mask = new Uint8Array(32 * 32).fill(1);
    transferTexture(healed, source, mask, { offsetY: 2, amount: 1 });
    const distinct = new Set<number>();
    for (let i = 0; i < healed.data.length; i += 4) distinct.add(healed.data[i]);
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("featherMask", () => {
  it("produces fractional coverage at the mask edge", () => {
    const mask = new Uint8Array(16 * 16);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) mask[y * 16 + x] = 1;
    const soft = featherMask(mask, 16, 16, 2);
    const centre = soft[8 * 16 + 8];
    const edge = soft[5 * 16 + 8];
    // Dilate-then-blur keeps the stroke interior fully covered…
    expect(centre).toBeGreaterThan(0.95);
    // …while the outside of the mask has faded away.
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(centre);
    // Pixels well outside the mask stay untouched.
    expect(soft[1 * 16 + 1]).toBeLessThan(0.05);
  });
});

describe("healRegion", () => {
  it("erases the word and returns the paper colour in the core", () => {
    const image = receiptLike();
    const result = healRegion(
      image,
      { x: 25, y: 20, width: 70, height: 18 },
      { mode: "auto", mask: "glyph", feather: 1, strength: 0.7 },
    );
    expect(result.coverage).toBeGreaterThan(0.05);
    const index = (28 * image.width + 32) * 4;
    expect(result.region.data[index]).toBeGreaterThan(170);
    expect(result.region.data[index + 1]).toBeGreaterThan(170);
    // Pixels outside the core are untouched.
    const outside = (5 * image.width + 5) * 4;
    expect(result.region.data[outside]).toBe(image.data[outside]);
  });

  it("switches to a box fill when the whole box is requested", () => {
    const image = receiptLike();
    const result = healRegion(
      image,
      { x: 25, y: 20, width: 70, height: 18 },
      { mode: "color", mask: "box", color: "#00ff00", feather: 0, strength: 0 },
    );
    expect(result.mode).toBe("color");
    const index = (28 * image.width + 32) * 4;
    // Flat fill: green channel dominates, red/blue are low.
    expect(result.region.data[index]).toBeLessThan(40);
    expect(result.region.data[index + 1]).toBeGreaterThan(200);
    expect(result.region.data[index + 2]).toBeLessThan(40);
  });

  it("carries the surrounding tone gradient through a colour fill", () => {
    // A dark-to-light ramp with a word on it: the fill must follow the ramp.
    const image = makeImage(120, 60, (x, y) => {
      const base = 120 + Math.round((x / 120) * 120);
      const inWord = y >= 22 && y <= 36 && x >= 30 && x <= 90 && Math.floor((x - 30) / 8) % 2 === 0;
      const v = inWord ? base - 100 : base;
      return [v, v, v];
    });
    const result = healRegion(
      image,
      { x: 25, y: 20, width: 70, height: 18 },
      { mode: "color", mask: "glyph", feather: 1, strength: 0.7 },
    );
    const left = (28 * image.width + 34) * 4;
    const right = (28 * image.width + 84) * 4;
    expect(result.region.data[left]).toBeLessThan(result.region.data[right]);
  });

  it("resolves auto mode per surface type", () => {
    const flat = receiptLike();
    const flatResult = healRegion(flat, { x: 25, y: 20, width: 70, height: 18 }, { mode: "auto" });
    expect(["color", "texture"]).toContain(flatResult.mode);

    const noisy = makeImage(120, 60, (x, y) => {
      const noise = ((x * 17 + y * 11) % 90) - 45;
      const inWord = y >= 22 && y <= 36 && x >= 30 && x <= 90 && Math.floor((x - 30) / 8) % 2 === 0;
      const base = inWord ? 30 : 160;
      return [base + noise, base + noise, base + noise];
    });
    const noisyResult = healRegion(noisy, { x: 25, y: 20, width: 70, height: 18 }, { mode: "auto" });
    expect(["diffusion", "texture", "color"]).toContain(noisyResult.mode);
  });

  it("keeps the pixels when the mode is none", () => {
    const image = receiptLike();
    const result = healRegion(image, { x: 25, y: 20, width: 70, height: 18 }, { mode: "none" });
    expect(Array.from(result.region.data)).toEqual(Array.from(image.data));
  });
});
