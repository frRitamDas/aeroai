import { describe, expect, it } from "vitest";
import { extractLines, groupWordsIntoLines, parseTsvWords } from "./ocr";
import type { OcrWord } from "./types";

const word = (text: string, x: number, y: number, width = 30, height = 12): OcrWord => ({
  text,
  confidence: 92,
  x,
  y,
  width,
  height,
  lineIndex: 0,
});

describe("parseTsvWords", () => {
  it("reads level-5 rows and skips everything else", () => {
    const tsv = [
      "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
      "1\t1\t0\t0\t0\t0\t0\t0\t600\t800\t-1\t",
      "5\t1\t1\t1\t1\t1\t30\t40\t52\t14\t96.5\tTotal",
      "5\t1\t1\t1\t1\t2\t90\t40\t30\t14\t88.1\t=10.50",
      "4\t1\t1\t1\t1\t0\t30\t40\t90\t14\t95\tTotal =10.50",
    ].join("\n");
    const words = parseTsvWords(tsv);
    expect(words).toHaveLength(2);
    expect(words[0]).toMatchObject({ text: "Total", x: 30, y: 40, width: 52 });
    expect(words[1].confidence).toBeCloseTo(88.1, 3);
  });

  it("returns nothing for malformed input", () => {
    expect(parseTsvWords("nonsense")).toEqual([]);
  });
});

describe("groupWordsIntoLines", () => {
  it("clusters words sharing a baseline and orders them left to right", () => {
    const words = [word("world", 60, 10), word("hello", 10, 10), word("second", 12, 40)];
    const lines = groupWordsIntoLines(words);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("hello world");
    expect(lines[0].x).toBeLessThan(lines[1].x);
    expect(lines[0].words).toHaveLength(2);
  });

  it("handles an empty list", () => {
    expect(groupWordsIntoLines([])).toEqual([]);
  });
});

describe("extractLines", () => {
  it("walks the nested blocks → paragraphs → lines shape", () => {
    const data = {
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                {
                  text: "Chicken Banana",
                  confidence: 91,
                  bbox: { x0: 10, y0: 20, x1: 210, y1: 40 },
                  words: [{ text: "Chicken", confidence: 94, bbox: { x0: 10, y0: 20, x1: 100, y1: 40 } }],
                },
              ],
            },
          ],
        },
      ],
    };
    const lines = extractLines(data);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Chicken Banana");
    expect(lines[0].width).toBe(200);
    expect(lines[0].words[0].text).toBe("Chicken");
  });

  it("falls back to a flat lines array", () => {
    const lines = extractLines({
      lines: [{ text: "Flat", confidence: 80, bbox: { x0: 1, y0: 2, x1: 21, y1: 12 } }],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Flat");
  });

  it("rebuilds lines from words when no line data exists", () => {
    const lines = extractLines({
      words: [
        { text: "one", confidence: 90, bbox: { x0: 0, y0: 0, x1: 20, y1: 10 } },
        { text: "two", confidence: 90, bbox: { x0: 25, y0: 0, x1: 45, y1: 10 } },
      ],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("one two");
  });

  it("parses TSV as a last resort", () => {
    const lines = extractLines({
      tsv: [
        "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
        "5\t1\t1\t1\t1\t1\t5\t6\t40\t12\t90\tInvoice",
      ].join("\n"),
    });
    expect(lines[0].text).toBe("Invoice");
  });

  it("returns an empty array for junk", () => {
    expect(extractLines(null)).toEqual([]);
    expect(extractLines({})).toEqual([]);
  });
});
