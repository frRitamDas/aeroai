import { describe, expect, it } from "vitest";
import { ALL_FONTS, analyseTraits, fontCss, fontStack, suggestFonts } from "./fonts";
import type { TextStats } from "./types";

const base: TextStats = {
  inkRatio: 0.14,
  strokeRatio: 0.11,
  slant: 0,
  serifScore: 0,
  xHeightRatio: 0.6,
};

describe("font metadata", () => {
  it("exposes a unique, usable catalogue", () => {
    const families = ALL_FONTS.map((font) => font.family);
    expect(new Set(families).size).toBe(families.length);
    expect(families.length).toBeGreaterThan(45);
    expect(ALL_FONTS.every((font) => font.weights.length > 0)).toBe(true);
  });

  it("builds css stacks for webfonts and system fonts", () => {
    expect(fontStack("Inter")).toContain("Inter");
    expect(fontStack("Times New Roman")).toContain("Times New Roman");
    expect(fontCss({ fontFamily: "Inter", fontSize: 18, fontWeight: 700, italic: true })).toBe(
      'italic 700 18px "Inter", sans-serif',
    );
    expect(fontCss({ fontFamily: "Lora", fontSize: 12, fontWeight: 400, italic: false })).toContain("serif");
  });
});

describe("analyseTraits", () => {
  it("maps stroke weight to a font weight ladder", () => {
    expect(analyseTraits({ ...base, strokeRatio: 0.05 }, "Hello").weight).toBe(200);
    expect(analyseTraits({ ...base, strokeRatio: 0.12 }, "Hello").weight).toBe(400);
    expect(analyseTraits({ ...base, strokeRatio: 0.18 }, "Hello").weight).toBe(700);
    expect(analyseTraits({ ...base, strokeRatio: 0.23 }, "Hello").weight).toBe(800);
    expect(analyseTraits({ ...base, strokeRatio: 0.32 }, "Hello").weight).toBe(900);
  });

  it("flags serifs, slanted text and dense (condensed) setting", () => {
    expect(analyseTraits({ ...base, serifScore: 0.6 }, "Times").serif).toBe(true);
    expect(analyseTraits({ ...base, slant: 14 }, "Slanted").italic).toBe(true);
    expect(analyseTraits({ ...base, inkRatio: 0.3 }, "Dense").widthClass).toBeLessThan(1);
    expect(analyseTraits({ ...base, inkRatio: 0.05 }, "Airy").widthClass).toBeGreaterThan(1);
  });

  it("detects all-caps and monospace-looking strings", () => {
    expect(analyseTraits(base, "INVOICE NO 1234").uppercase).toBe(true);
    expect(analyseTraits(base, "100-200-300").mono).toBe(true);
    expect(analyseTraits(base, "Hello world").uppercase).toBe(false);
  });
});

describe("suggestFonts", () => {
  it("prefers serif families for serif statistics", () => {
    const suggestions = suggestFonts({ ...base, serifScore: 0.7, strokeRatio: 0.12 }, "The Times", 4);
    expect(suggestions.length).toBe(4);
    const top3 = suggestions.slice(0, 3).map((item) => item.family);
    const serifFamilies = ["Merriweather", "Playfair Display", "Lora", "PT Serif", "EB Garamond", "Libre Baskerville", "Noto Serif", "Source Serif 4", "Crimson Text", "Bitter"];
    expect(top3.some((family) => serifFamilies.includes(family))).toBe(true);
  });

  it("prefers handwriting fonts for fast slanted strokes", () => {
    const suggestions = suggestFonts({ ...base, slant: 20, strokeRatio: 0.16, serifScore: 0.05 }, "note", 3);
    const handFamilies = ["Caveat", "Pacifico", "Dancing Script", "Great Vibes", "Satisfy", "Permanent Marker", "Kalam", "Shadows Into Light"];
    expect(handFamilies).toContain(suggestions[0].family);
  });

  it("always returns scored, explained suggestions with valid weights", () => {
    const suggestions = suggestFonts(base, "Receipt", 4);
    for (const suggestion of suggestions) {
      expect(suggestion.score).toBeGreaterThanOrEqual(0);
      expect(suggestion.score).toBeLessThanOrEqual(1);
      expect(suggestion.reason.length).toBeGreaterThan(0);
      const meta = ALL_FONTS.find((font) => font.family === suggestion.family)!;
      expect(meta.weights).toContain(suggestion.weight);
      if (suggestion.italic) expect(meta.italic).toBe(true);
    }
    expect(suggestions[0].score).toBeGreaterThanOrEqual(suggestions[1].score);
  });

  it("returns a bold suggestion for heavy ink", () => {
    const suggestions = suggestFonts({ ...base, strokeRatio: 0.24 }, "SALE", 2);
    expect(suggestions[0].weight).toBeGreaterThanOrEqual(700);
  });
});
