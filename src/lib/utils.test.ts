import { describe, expect, it } from "vitest";
import { clamp, formatBytes, hashString, seededRandom, uid } from "./utils";

describe("utils", () => {
  it("clamps values", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });

  it("hashes deterministically", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
    expect(hashString("hello")).not.toBe(hashString("world"));
  });

  it("generates repeatable pseudo random sequences", () => {
    const a = seededRandom(9);
    const b = seededRandom(9);
    const sequenceA = [a(), a(), a()];
    const sequenceB = [b(), b(), b()];
    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceA.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(seededRandom(10)()).not.toBe(sequenceA[0]);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid("t")));
    expect(ids.size).toBe(500);
    expect([...ids].every((id) => id.startsWith("t_"))).toBe(true);
  });
});
