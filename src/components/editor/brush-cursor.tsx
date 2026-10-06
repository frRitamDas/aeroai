"use client";

import { cn } from "@/lib/utils";
import type { BrushMode } from "@/lib/editor/types";

export function BrushCursor({
  point,
  scale,
  origin,
  size,
  mode,
  visible,
}: {
  point: { x: number; y: number } | null;
  scale: number;
  origin: { x: number; y: number };
  size: number;
  mode: BrushMode;
  visible: boolean;
}) {
  if (!visible || !point) return null;
  const diameter = Math.max(6, size * scale);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        className={cn(
          "absolute rounded-full border mix-blend-difference",
          mode === "clone" ? "border-white" : mode === "blur" ? "border-sky-300" : "border-amber-200",
        )}
        style={{
          left: origin.x + point.x * scale - diameter / 2,
          top: origin.y + point.y * scale - diameter / 2,
          width: diameter,
          height: diameter,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
        }}
      />
      <span
        className="absolute rounded-full bg-white/80"
        style={{
          left: origin.x + point.x * scale - 1,
          top: origin.y + point.y * scale - 1,
          width: 2,
          height: 2,
        }}
      />
    </div>
  );
}
