import type { BaseLayer, Layer } from "./types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type HandleId =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate"
  | "move";

export const HANDLES: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function normalizeRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function rotatePoint(point: Point, origin: Point, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Rotate a free vector (no origin translation). */
export function rotateVector(vector: Point, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

export function layerRect(layer: BaseLayer): Rect {
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
}

export function layerCorners(layer: BaseLayer): Point[] {
  const c = rectCenter(layerRect(layer));
  const rect = layerRect(layer);
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ].map((p) => rotatePoint(p, c, layer.rotation));
}

export function pointInLayer(layer: BaseLayer, point: Point, tolerance = 0): boolean {
  const c = rectCenter(layerRect(layer));
  const local = rotatePoint(point, c, -layer.rotation);
  return (
    local.x >= layer.x - tolerance &&
    local.x <= layer.x + layer.width + tolerance &&
    local.y >= layer.y - tolerance &&
    local.y <= layer.y + layer.height + tolerance
  );
}

/** Topmost layer under the point (last in paint order wins). */
export function hitTest(layers: Layer[], point: Point, tolerance = 0): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible || layer.locked) continue;
    if (pointInLayer(layer, point, tolerance)) return layer;
  }
  return null;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function boundsOfLayers(layers: Layer[]): Rect | null {
  if (!layers.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    for (const corner of layerCorners(layer)) {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function expandRect(rect: Rect, by: number): Rect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + by * 2,
    height: rect.height + by * 2,
  };
}

export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(rect.x, Math.max(0, width - 1)));
  const y = Math.max(0, Math.min(rect.y, Math.max(0, height - 1)));
  return {
    x,
    y,
    width: Math.max(1, Math.min(rect.width, width - x)),
    height: Math.max(1, Math.min(rect.height, height - y)),
  };
}

export function handlePoint(rect: Rect, handle: HandleId): Point {
  switch (handle) {
    case "nw":
      return { x: rect.x, y: rect.y };
    case "n":
      return { x: rect.x + rect.width / 2, y: rect.y };
    case "ne":
      return { x: rect.x + rect.width, y: rect.y };
    case "e":
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case "se":
      return { x: rect.x + rect.width, y: rect.y + rect.height };
    case "s":
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case "sw":
      return { x: rect.x, y: rect.y + rect.height };
    case "w":
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case "rotate":
      return { x: rect.x + rect.width / 2, y: rect.y - 24 };
    default:
      return rectCenter(rect);
  }
}

/**
 * Resize a (possibly rotated) box by dragging one of its handles while the
 * opposite edge stays anchored — the maths is done in the layer's local
 * space so rotated layers behave like every other graphics tool.
 */
export function resizeLayer(
  layer: BaseLayer,
  handle: HandleId,
  pointer: Point,
  options: { keepAspect?: boolean; minSize?: number } = {},
): { x: number; y: number; width: number; height: number } {
  const minSize = options.minSize ?? 8;
  const oldRect = layerRect(layer);
  const centre = rectCenter(oldRect);
  const local = rotatePoint(pointer, centre, -layer.rotation);

  // The point that must not move: the opposite corner / edge midpoint.
  const anchor = handlePoint(oldRect, handle === "move" ? "se" : handle);

  let { x, y, width, height } = oldRect;
  const right = x + width;
  const bottom = y + height;

  switch (handle) {
    case "nw":
      x = Math.min(local.x, right - minSize);
      y = Math.min(local.y, bottom - minSize);
      width = right - x;
      height = bottom - y;
      break;
    case "n":
      y = Math.min(local.y, bottom - minSize);
      height = bottom - y;
      break;
    case "ne":
      y = Math.min(local.y, bottom - minSize);
      height = bottom - y;
      width = Math.max(minSize, local.x - x);
      break;
    case "e":
      width = Math.max(minSize, local.x - x);
      break;
    case "se":
      width = Math.max(minSize, local.x - x);
      height = Math.max(minSize, local.y - y);
      break;
    case "s":
      height = Math.max(minSize, local.y - y);
      break;
    case "sw":
      x = Math.min(local.x, right - minSize);
      width = right - x;
      height = Math.max(minSize, local.y - y);
      break;
    case "w":
      x = Math.min(local.x, right - minSize);
      width = right - x;
      break;
    default:
      break;
  }

  if (options.keepAspect && oldRect.width && oldRect.height) {
    const ratio = oldRect.width / oldRect.height;
    if (handle === "nw" || handle === "ne" || handle === "se" || handle === "sw") {
      const byWidth = { width, height: width / ratio };
      const byHeight = { width: height * ratio, height };
      const pick =
        Math.abs(byWidth.height - height) < Math.abs(byHeight.width - width) ? byWidth : byHeight;
      // The corner opposite the handle stays pinned.
      if (handle === "nw") x = right - pick.width;
      if (handle === "nw" || handle === "ne") y = bottom - pick.height;
      width = Math.max(minSize, pick.width);
      height = Math.max(minSize, pick.height);
    }
  }

  const next = { x, y, width, height };
  if (!layer.rotation) return next;

  /**
   * Rotated layers are drawn centred on their own rect centre, so resizing in
   * local space alone would make the "fixed" edge drift away from the pointer.
   * We solve for the centre that keeps the anchor exactly where it was in world
   * space:  u = (R(θ) − I)⁻¹ · (A_world − A_local),  C_new = A_local − u.
   */
  const anchorWorld = rotatePoint(anchor, centre, layer.rotation);
  const dx = anchorWorld.x - anchor.x;
  const dy = anchorWorld.y - anchor.y;
  const rad = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const a = cos - 1;
  const b = sin;
  const denominator = a * a + b * b;
  if (Math.abs(denominator) < 1e-9) return next;
  const ux = (a * dx + b * dy) / denominator;
  const uy = (-b * dx + a * dy) / denominator;
  const newCentre = { x: anchor.x - ux, y: anchor.y - uy };

  return {
    x: newCentre.x - next.width / 2,
    y: newCentre.y - next.height / 2,
    width: next.width,
    height: next.height,
  };
}

export function rotateLayer(layer: BaseLayer, pointer: Point, snap = false): number {
  const centre = rectCenter(layerRect(layer));
  const angle = (Math.atan2(pointer.y - centre.y, pointer.x - centre.x) * 180) / Math.PI + 90;
  if (snap) {
    const step = 15;
    return Math.round(angle / step) * step;
  }
  return Math.round(angle * 10) / 10;
}

/** Distance from a point to a segment, used for brush hit-tests. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
