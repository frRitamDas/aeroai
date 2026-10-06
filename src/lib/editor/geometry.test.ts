import { describe, expect, it } from "vitest";
import {
  boundsOfLayers,
  rotatePoint,
  hitTest,
  normalizeRect,
  pointInLayer,
  rectsIntersect,
  resizeLayer,
  rotateLayer,
} from "./geometry";
import type { TextLayer } from "./types";

function layer(partial: Partial<TextLayer> = {}): TextLayer {
  return {
    id: "a",
    kind: "text",
    name: "a",
    x: 100,
    y: 100,
    width: 200,
    height: 40,
    rotation: 0,
    visible: true,
    locked: false,
    text: "hello",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: 400,
    italic: false,
    underline: false,
    align: "left",
    color: "#000",
    opacity: 1,
    letterSpacing: 0,
    lineHeight: 1.2,
    autoFit: true,
    effects: {
      inkSpread: 0,
      softness: 0,
      grain: 0,
      jpeg: 0,
      opacityJitter: 0,
      blendEdges: 0,
    },
    patch: {
      enabled: false,
      mode: "auto",
      mask: "auto",
      color: "#fff",
      feather: 2,
      expand: 1,
      textureOffset: 0,
      strength: 0.6,
    },
    ...partial,
  };
}

describe("rect helpers", () => {
  it("normalises drag rectangles from any direction", () => {
    expect(normalizeRect({ x: 10, y: 20 }, { x: 30, y: 5 })).toEqual({
      x: 10,
      y: 5,
      width: 20,
      height: 15,
    });
  });

  it("detects overlap", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 5, height: 5 })).toBe(false);
  });
});

describe("hit testing", () => {
  it("respects rotation, tolerance, lock and visibility", () => {
    const upright = layer();
    expect(pointInLayer(upright, { x: 150, y: 120 })).toBe(true);
    expect(pointInLayer(upright, { x: 150, y: 300 })).toBe(false);

    const rotated = layer({ rotation: 90 });
    // After a 90° rotation the 200x40 box becomes 40 wide and 200 tall around
    // its centre (200, 120): x 180..220, y 20..220.
    expect(pointInLayer(rotated, { x: 200, y: 210 })).toBe(true);
    expect(pointInLayer(rotated, { x: 200, y: 260 })).toBe(false);
    expect(pointInLayer(rotated, { x: 110, y: 110 })).toBe(false);

    expect(hitTest([layer({ locked: true })], { x: 150, y: 120 })).toBeNull();
    expect(hitTest([layer({ visible: false })], { x: 150, y: 120 })).toBeNull();
    expect(hitTest([layer()], { x: 150, y: 120 })?.id).toBe("a");
  });

  it("returns the topmost overlapping layer", () => {
    const bottom = layer({ id: "bottom" });
    const top = layer({ id: "top", y: 110 });
    expect(hitTest([bottom, top], { x: 150, y: 120 })?.id).toBe("top");
  });

  it("measures selection bounds across rotated layers", () => {
    const bounds = boundsOfLayers([layer(), layer({ id: "b", x: 0, y: 0, width: 10, height: 10 })]);
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(0);
    expect(bounds!.width).toBe(300);
  });
});

describe("transforms", () => {
  it("rotates a point around an origin", () => {
    const rotated = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(rotated.x).toBeCloseTo(0, 6);
    expect(rotated.y).toBeCloseTo(10, 6);
  });

  it("keeps the opposite edge anchored while resizing", () => {
    const target = layer();
    const result = resizeLayer(target, "se", { x: 400, y: 300 }, { minSize: 4 });
    // Left/top untouched…
    expect(result.x).toBeCloseTo(100, 6);
    expect(result.y).toBeCloseTo(100, 6);
    // …bottom-right follows the pointer.
    expect(result.x + result.width).toBeCloseTo(400, 6);
    expect(result.y + result.height).toBeCloseTo(300, 6);
  });

  it("resizes the west handle without moving the right edge", () => {
    const target = layer();
    const result = resizeLayer(target, "w", { x: 150, y: 120 }, { minSize: 4 });
    expect(result.x).toBeCloseTo(150, 6);
    expect(result.x + result.width).toBeCloseTo(300, 6);
  });

  it("never shrinks below the minimum size", () => {
    const target = layer();
    const result = resizeLayer(target, "e", { x: -500, y: 120 }, { minSize: 12 });
    expect(result.width).toBe(12);
  });

  it("keeps the anchor fixed in world space for rotated layers", () => {
    const target = layer({ rotation: 90 });
    const centre = { x: 200, y: 120 };
    // World position of the local (unrotated) top-left corner: the anchor.
    const anchorWorld = rotatePoint({ x: 100, y: 100 }, centre, 90);

    // Pointer at world (160, 260) is local (340, 160) — i.e. 40 right and 20
    // down of the original bottom-right, so the box should grow by that much.
    const result = resizeLayer(target, "se", { x: 160, y: 260 }, { minSize: 4 });
    expect(result.width).toBeCloseTo(240, 4);
    expect(result.height).toBeCloseTo(60, 4);

    // The anchor corner must land on exactly the same world point as before.
    const newCentre = { x: result.x + result.width / 2, y: result.y + result.height / 2 };
    const anchorAfter = rotatePoint({ x: 100, y: 100 }, newCentre, 90);
    expect(anchorAfter.x).toBeCloseTo(anchorWorld.x, 4);
    expect(anchorAfter.y).toBeCloseTo(anchorWorld.y, 4);
  });

  it("keeps anchor corners fixed for every handle on rotated layers", () => {
    for (const handle of ["nw", "ne", "sw", "se"] as const) {
      const target = layer({ rotation: 32 });
      const centre = { x: 200, y: 120 };
      const localAnchor = {
        nw: { x: 300, y: 140 },
        ne: { x: 100, y: 140 },
        sw: { x: 300, y: 100 },
        se: { x: 100, y: 100 },
      }[handle];
      const anchorWorld = rotatePoint(localAnchor, centre, 32);
      const pointer = rotatePoint({ x: 200, y: 200 }, centre, -32);
      const result = resizeLayer(target, handle, pointer, { minSize: 4 });
      const newCentre = { x: result.x + result.width / 2, y: result.y + result.height / 2 };
      const anchorAfter = rotatePoint(localAnchor, newCentre, 32);
      expect(anchorAfter.x).toBeCloseTo(anchorWorld.x, 3);
      expect(anchorAfter.y).toBeCloseTo(anchorWorld.y, 3);
    }
  });

  it("keeps aspect ratio for corner drags when asked", () => {
    const target = layer({ width: 200, height: 40 });
    const result = resizeLayer(target, "se", { x: 300, y: 160 }, { keepAspect: true, minSize: 4 });
    expect(result.width / result.height).toBeCloseTo(5, 1);
  });

  it("snaps rotation to 15° steps when snapping is on", () => {
    const target = layer();
    const snapped = rotateLayer(target, { x: 500, y: 118 }, true);
    expect(snapped % 15).toBe(0);
    const free = rotateLayer(target, { x: 500, y: 122 }, false);
    expect(Math.abs(free - snapped)).toBeLessThan(15);
  });
});
