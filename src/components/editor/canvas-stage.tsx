"use client";

import * as React from "react";
import {
  composePage,
  drawBrushBatches,
  invalidateBase,
  renderBase,
  type PhotoFinish,
} from "@/lib/editor/render";
import { createCanvas, getContext, samplePixel } from "@/lib/editor/image";
import {
  hitTest,
  handlePoint,
  layerCorners,
  normalizeRect,
  pointInLayer,
  resizeLayer,
  rotateLayer,
  type HandleId,
  type Point,
  type Rect,
} from "@/lib/editor/geometry";
import { fitFontSizeToBox, fontCss } from "@/lib/editor/fonts";
import {
  createCleanupLayer,
  createTextLayerFromBox,
  useEditor,
  type EditorState,
} from "@/lib/editor/store";
import type { BrushStroke, Layer, Page, TextLayer } from "@/lib/editor/types";
import { clamp, cn, hashString } from "@/lib/utils";
import { BrushCursor } from "./brush-cursor";
import { TextBoxEditor } from "./text-box-editor";

type Interaction =
  | { type: "none" }
  | {
      type: "move";
      ids: string[];
      start: Point;
      origin: Record<string, { x: number; y: number }>;
      moved: boolean;
      recorded: boolean;
    }
  | {
      type: "resize";
      id: string;
      handle: HandleId;
      start: Point;
      box: { x: number; y: number; width: number; height: number };
      keepAspect: boolean;
      recorded: boolean;
    }
  | {
      type: "rotate";
      id: string;
      pointers: Map<number, Point>;
      recorded: boolean;
    }
  | {
      type: "marquee";
      start: Point;
      additive: boolean;
      current: Point;
    }
  | {
      type: "create";
      start: Point;
      current: Point;
      kind: "text" | "cleanup";
    }
  | { type: "pan"; start: Point; origin: { x: number; y: number } }
  | { type: "brush"; stroke: BrushStroke };

const HANDLE_SIZE = 9;
const HANDLE_HIT = 12;

export interface CanvasStageProps {
  page: Page | null;
  className?: string;
}

export function CanvasStage({ page, className }: CanvasStageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const [interaction, setInteraction] = React.useState<Interaction>({ type: "none" });
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const [brushCursor, setBrushCursor] = React.useState<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = React.useState<Rect | null>(null);
  const spacePressed = React.useRef(false);

  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.zoom);
  const offset = useEditor((s) => s.offset);
  const fit = useEditor((s) => s.fit);
  const selection = useEditor((s) => s.selection);
  const showBoxes = useEditor((s) => s.showBoxes);
  const showOriginal = useEditor((s) => s.showOriginal);
  const finishEnabled = useEditor((s) => s.finishEnabled);
  const finish = useEditor((s) => s.finish);
  const brush = useEditor((s) => s.brush);
  const brushMode = useEditor((s) => s.brushMode);
  const setOffset = useEditor((s) => s.setOffset);
  const setZoom = useEditor((s) => s.setZoom);
  const selectLayers = useEditor((s) => s.selectLayers);
  const setBrush = useEditor((s) => s.setBrush);
  const setStatus = useEditor((s) => s.setStatus);

  const scale = React.useMemo(() => {
    if (!page || !viewport.width || !viewport.height) return 1;
    if (!fit) return zoom;
    const pad = 48;
    return Math.min(
      1,
      (viewport.width - pad) / page.width,
      (viewport.height - pad) / page.height,
    );
  }, [fit, page, viewport, zoom]);

  /** Where the page sits inside the viewport (in CSS px). */
  const origin = React.useMemo(() => {
    if (!page) return { x: 0, y: 0 };
    if (!fit) return offset;
    return {
      x: (viewport.width - page.width * scale) / 2,
      y: (viewport.height - page.height * scale) / 2,
    };
  }, [fit, offset, page, scale, viewport]);

  /* ---------------------------- viewport ---------------------------- */

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () =>
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Repaint when anything that affects pixels changes: geometry, typography,
  // effects, patch settings, visibility and brush strokes. `source` (the OCR
  // bookkeeping: suggestions, stats) is deliberately stripped — it never
  // affects rendering and would make the signature needlessly large.
  const revision = useEditor((s) => {
    const current = s.pages.find((item) => item.id === s.activePageId);
    if (!current) return "";
    return hashString(
      JSON.stringify([
        current.layers,
        current.brushBatches.map((batch) => [batch.revision, batch.strokes.length]),
      ], (key, value) => (key === "suggestions" ? undefined : value)),
    );
  });

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressed.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressed.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* --------------------------- compositing -------------------------- */

  const activePage = page;
  const dragging = interaction.type !== "none" && interaction.type !== "brush";

  React.useEffect(() => {
    if (!activePage) return;
    let cancelled = false;
    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    const maxDimension = 7000;
    const wanted = scale * dpr * (dragging ? 0.75 : 1);
    const renderScale = Math.max(
      0.05,
      Math.min(dragging ? 1.25 : 3, wanted, maxDimension / Math.max(activePage.width, activePage.height)),
    );

    const run = async () => {
      setRendering(true);
      try {
        const finishOption: PhotoFinish | null =
          showOriginal || !finishEnabled ? null : finish;
        const { canvas } = await composePage(activePage, {
          scale: renderScale,
          draft: dragging,
          excludeLayerIds: editingId ? [editingId] : [],
          finish: finishOption,
        });
        if (cancelled) return;
        const target = canvasRef.current;
        if (!target) return;
        if (target.width !== canvas.width || target.height !== canvas.height) {
          target.width = canvas.width;
          target.height = canvas.height;
        }
        const ctx = getContext(target);
        ctx.clearRect(0, 0, target.width, target.height);
        if (showOriginal) {
          ctx.drawImage(canvas, 0, 0);
        } else {
          ctx.drawImage(canvas, 0, 0);
        }
      } catch (error) {
        setStatus(`Render failed: ${(error as Error).message}`);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    activePage,
    scale,
    dragging,
    editingId,
    finish,
    finishEnabled,
    showOriginal,
    revision,
    setStatus,
  ]);

  /* --------------------------- coordinates -------------------------- */

  const toDoc = React.useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - origin.x) / scale,
        y: (clientY - rect.top - origin.y) / scale,
      };
    },
    [origin, scale],
  );

  const layers = React.useMemo(() => activePage?.layers ?? [], [activePage]);

  const handleHitTest = React.useCallback(
    (docPoint: Point): { layer: Layer; handle: HandleId } | null => {
      if (!showBoxes) return null;
      const tolerance = HANDLE_HIT / scale;
      for (let index = selection.length - 1; index >= 0; index--) {
        const layer = layers.find((item) => item.id === selection[index]);
        if (!layer || layer.locked) continue;
        const rect = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
        const rotateHandle = handlePoint(rect, "rotate");
        const centre = { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
        const angle = (layer.rotation * Math.PI) / 180;
        const rotatePoint = {
          x:
            centre.x +
            (rotateHandle.x - centre.x) * Math.cos(angle) -
            (rotateHandle.y - centre.y) * Math.sin(angle),
          y:
            centre.y +
            (rotateHandle.x - centre.x) * Math.sin(angle) +
            (rotateHandle.y - centre.y) * Math.cos(angle),
        };
        if (Math.hypot(docPoint.x - rotatePoint.x, docPoint.y - rotatePoint.y) < tolerance) {
          return { layer, handle: "rotate" };
        }
        for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as HandleId[]) {
          const local = handlePoint(rect, handle);
          const rotated = {
            x:
              centre.x +
              (local.x - centre.x) * Math.cos(angle) -
              (local.y - centre.y) * Math.sin(angle),
            y:
              centre.y +
              (local.x - centre.x) * Math.sin(angle) +
              (local.y - centre.y) * Math.cos(angle),
          };
          if (Math.hypot(docPoint.x - rotated.x, docPoint.y - rotated.y) < tolerance) {
            return { layer, handle };
          }
        }
      }
      return null;
    },
    [layers, scale, selection, showBoxes],
  );

  const previewStroke = React.useCallback(
    (stroke: BrushStroke) => {
      if (!activePage) return;
      const target = canvasRef.current;
      if (!target) return;
      const dprScale = target.width / activePage.width;
      const preview = createCanvas(target.width, target.height);
      const ctx = getContext(preview);
      ctx.drawImage(target, 0, 0);
      drawBrushBatches(preview, activePage, [{ id: "preview", strokes: [stroke], revision: 0 }], dprScale);
      const visible = getContext(target);
      visible.clearRect(0, 0, target.width, target.height);
      visible.drawImage(preview, 0, 0);
    },
    [activePage],
  );

  /** Enter in-place editing and take one history snapshot for the session. */
  const beginEditing = React.useCallback((id: string) => {
    useEditor.getState().pushHistory();
    setEditingId(id);
  }, []);

  const commitEditing = React.useCallback(() => {
    if (!editingId) return;
    const state = useEditor.getState();
    const layer = state.pages
      .find((item) => item.id === state.activePageId)
      ?.layers.find((item) => item.id === editingId) as TextLayer | undefined;
    setEditingId(null);
    if (layer && !layer.text.trim()) {
      state.removeLayers([layer.id]);
    }
  }, [editingId]);

  const sampleFromCanvas = React.useCallback(
    (docPoint: Point) => {
      const target = canvasRef.current;
      if (!target || !activePage) return null;
      const ratio = target.width / activePage.width;
      return samplePixel(target, docPoint.x * ratio, docPoint.y * ratio);
    },
    [activePage],
  );

  /* ---------------------------- pointer ----------------------------- */

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!page || event.button === 2) return;
      // Space-drag, middle-click or the Pan tool all pan the canvas.
      const isPanGesture = tool === "pan" || event.button === 1 || spacePressed.current;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      const docPoint = toDoc(event.clientX, event.clientY);

      if (isPanGesture) {
        setInteraction({ type: "pan", start: docPoint, origin: { ...origin } });
        return;
      }

      const brushArmed =
        tool === "heal" ||
        (brushMode === "on" && tool !== "text" && tool !== "box" && tool !== "pick");
      if (brushArmed) {
        const stroke: BrushStroke = {
          points: [docPoint.x, docPoint.y],
          size: brush.size,
          hardness: brush.hardness,
          mode: brush.mode,
          color: brush.color,
          offsetX: brush.source ? brush.source.x - docPoint.x : 24,
          offsetY: brush.source ? brush.source.y - docPoint.y : 24,
          blur: Math.max(1, brush.size * 0.25),
        };
        setInteraction({ type: "brush", stroke });
        return;
      }

      if (tool === "pick") {
        const color = sampleFromCanvas(docPoint);
        if (color) {
          setBrush({ color });
          for (const id of selection) {
            const layer = layers.find((item) => item.id === id);
            if (layer?.kind === "text") {
              useEditor.getState().updateLayer(id, { color, patch: { color } }, { record: true });
            }
          }
          setStatus(`Picked ${color}`);
        }
        return;
      }

      if (tool === "text" || tool === "box") {
        setInteraction({
          type: "create",
          start: docPoint,
          current: docPoint,
          kind: tool === "text" ? "text" : "cleanup",
        });
        return;
      }

      const handleHit = handleHitTest(docPoint);
      if (handleHit) {
        useEditor.getState().pushHistory();
        if (handleHit.handle === "rotate") {
          setInteraction({
            type: "rotate",
            id: handleHit.layer.id,
            pointers: new Map([[event.pointerId, docPoint]]),
            recorded: true,
          });
        } else {
          setInteraction({
            type: "resize",
            id: handleHit.layer.id,
            handle: handleHit.handle,
            start: docPoint,
            box: {
              x: handleHit.layer.x,
              y: handleHit.layer.y,
              width: handleHit.layer.width,
              height: handleHit.layer.height,
            },
            keepAspect: event.shiftKey,
            recorded: true,
          });
        }
        return;
      }

      const hit = hitTest(layers, docPoint, 2 / scale);
      if (hit) {
        const additive = event.shiftKey;
        const ids = additive
          ? Array.from(new Set([...selection, hit.id]))
          : selection.includes(hit.id)
            ? selection
            : [hit.id];
        selectLayers(ids);
        const originMap: Record<string, { x: number; y: number }> = {};
        for (const id of ids) {
          const layer = layers.find((item) => item.id === id);
          if (layer) originMap[id] = { x: layer.x, y: layer.y };
        }
        setInteraction({ type: "move", ids, start: docPoint, origin: originMap, moved: false, recorded: false });
        return;
      }

      if (editingId) commitEditing();
      setInteraction({
        type: "marquee",
        start: docPoint,
        current: docPoint,
        additive: event.shiftKey,
      });
      if (!event.shiftKey) selectLayers([]);
      return;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brush, brushMode, editingId, handleHitTest, layers, origin, page, scale, selectLayers, selection, setBrush, setStatus, toDoc, tool],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!page) return;
      const docPoint = toDoc(event.clientX, event.clientY);

      if (interaction.type === "none" || interaction.type === "marquee") {
        const painting =
        tool === "heal" || (brushMode === "on" && tool !== "text" && tool !== "box" && tool !== "pick");
      setBrushCursor(painting ? docPoint : null);
      }

      switch (interaction.type) {
        case "pan": {
          setOffset({
            x: interaction.origin.x + (docPoint.x - interaction.start.x) * scale,
            y: interaction.origin.y + (docPoint.y - interaction.start.y) * scale,
          });
          return;
        }
        case "move": {
          useEditor.getState().mutate((doc) => {
            const target = doc.pages.find((item) => item.id === doc.activePageId);
            if (!target) return;
            target.layers = target.layers.map((layer) => {
              const start = interaction.origin[layer.id];
              if (!start) return layer;
              return {
                ...layer,
                x: start.x + (docPoint.x - interaction.start.x),
                y: start.y + (docPoint.y - interaction.start.y),
              };
            });
          });
          setInteraction({ ...interaction, moved: true });
          return;
        }
        case "resize": {
          const layer = layers.find((item) => item.id === interaction.id);
          if (!layer) return;
          const next = resizeLayer(layer, interaction.handle, docPoint, {
            keepAspect: interaction.keepAspect || event.shiftKey,
            minSize: 10 / scale,
          });
          useEditor.getState().setLayerBox(interaction.id, next, { record: false });
          return;
        }
        case "rotate": {
          const layer = layers.find((item) => item.id === interaction.id);
          if (!layer) return;
          useEditor
            .getState()
            .setLayerBox(interaction.id, { ...layerBox(layer), rotation: rotateLayer(layer, docPoint, event.shiftKey) }, { record: false });
          return;
        }
        case "create": {
          const next = { ...interaction, current: docPoint };
          setInteraction(next);
          setMarqueeRect(normalizeRect(next.start, next.current));
          return;
        }
        case "marquee": {
          const next = { ...interaction, current: docPoint };
          setInteraction(next);
          const rect = normalizeRect(next.start, next.current);
          setMarqueeRect(rect);
          const inside = layers
            .filter((layer) => layer.visible)
            .filter((layer) =>
              layerCorners(layer).every(
                (corner) =>
                  corner.x >= rect.x &&
                  corner.x <= rect.x + rect.width &&
                  corner.y >= rect.y &&
                  corner.y <= rect.y + rect.height,
              ),
            )
            .map((layer) => layer.id);
          selectLayers(inside);
          return;
        }
        case "brush": {
          const stroke = { ...interaction.stroke, points: [...interaction.stroke.points, docPoint.x, docPoint.y] };
          setInteraction({ type: "brush", stroke });
          setBrushCursor(docPoint);
          previewStroke(stroke);
          return;
        }
        default:
          return;
      }
    },
    [brushMode, interaction, layers, page, previewStroke, scale, selectLayers, setOffset, toDoc, tool],
  );

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const finish = () => {
        setMarqueeRect(null);
        setInteraction({ type: "none" });
      };
      if (!page) {
        finish();
        return;
      }
      const docPoint = toDoc(event.clientX, event.clientY);

      switch (interaction.type) {
        case "move": {
          // The drag moved layers through `mutate`; a single history entry was
          // captured on pointer-down, so undo restores the pre-drag position.
          finish();
          return;
        }
        case "resize":
        case "rotate": {
          finish();
          return;
        }
        case "create": {
          const rect = normalizeRect(interaction.start, interaction.current);
          finish();
          if (rect.width < 6 || rect.height < 6) {
            setStatus("Drag to draw a box, or click to create a default-sized box.");
            const fallback = {
              x: docPoint.x - 80,
              y: docPoint.y - 14,
              width: 160,
              height: 28,
            };
            if (interaction.kind === "text") {
              const layer = createTextLayerFromBox(fallback);
              useEditor.getState().addLayer(layer);
              setEditingId(layer.id);
            } else {
              useEditor.getState().addLayer(createCleanupLayer(fallback));
            }
            return;
          }
          if (interaction.kind === "text") {
            const layer = createTextLayerFromBox(rect);
            useEditor.getState().addLayer(layer);
            setEditingId(layer.id);
            setStatus("Type the replacement text. Press Esc when done.");
          } else {
            useEditor.getState().addLayer(cleanupFromRect(rect));
            setStatus("Cleanup patch added — tune it in the Patch tab.");
          }
          return;
        }
        case "brush": {
          const stroke = interaction.stroke;
          finish();
          if (stroke.points.length < 4) return;
          useEditor.getState().addStroke(stroke);
          return;
        }
        default:
          finish();
      }
    },
    [interaction, page, setStatus, toDoc],
  );

  /* ----------------------------- wheel ------------------------------ */

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!page) return;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = element.getBoundingClientRect();
        const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const currentScale = scale;
        const docPoint = {
          x: (pointer.x - origin.x) / currentScale,
          y: (pointer.y - origin.y) / currentScale,
        };
        const nextZoom = clamp(currentScale * (event.deltaY < 0 ? 1.12 : 0.89), 0.05, 8);
        setZoom(nextZoom);
        setOffset({
          x: pointer.x - docPoint.x * nextZoom,
          y: pointer.y - docPoint.y * nextZoom,
        });
        return;
      }
      event.preventDefault();
      setOffset({ x: origin.x - event.deltaX, y: origin.y - event.deltaY });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [origin, page, scale, setOffset, setZoom]);

  /* -------------------------- double click -------------------------- */

  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!page) return;
      const docPoint = toDoc(event.clientX, event.clientY);
      const hit = hitTest(layers, docPoint, 4 / scale);
      if (hit?.kind === "text") {
        selectLayers([hit.id]);
        beginEditing(hit.id);
        return;
      }
      if (!hit) {
        const rect = { x: docPoint.x - 90, y: docPoint.y - 16, width: 180, height: 32 };
        const layer = createTextLayerFromBox(rect, { autoFit: true });
        useEditor.getState().addLayer(layer);
        setEditingId(layer.id);
      }
    },
    [beginEditing, layers, page, scale, selectLayers, toDoc],
  );

  /* ------------------------- selection overlay ---------------------- */

  const selectedLayers = React.useMemo(
    () => layers.filter((layer) => selection.includes(layer.id)),
    [layers, selection],
  );

  const editingLayer = React.useMemo(
    () => (layers.find((layer) => layer.id === editingId) as TextLayer | undefined) ?? null,
    [editingId, layers],
  );

  if (!page) return null;

  const cursor =
    tool === "pan"
      ? "grab"
      : tool === "heal" || brushMode === "on"
        ? "none"
        : tool === "pick"
          ? "crosshair"
          : tool === "text" || tool === "box"
            ? "crosshair"
            : "default";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative size-full select-none overflow-hidden",
        className,
      )}
      style={{ backgroundColor: "var(--canvas-bg)", cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setBrushCursor(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* Page frame */}
      <div
        className="absolute left-0 top-0 shadow-[0_2px_6px_rgba(9,12,24,0.18),0_24px_60px_-30px_rgba(9,12,24,0.55)]"
        style={{
          transform: `translate3d(${origin.x}px, ${origin.y}px, 0)`,
          width: page.width * scale,
          height: page.height * scale,
          willChange: "transform",
        }}
      >
        <canvas
          ref={canvasRef}
          className="block size-full"
          style={{ width: "100%", height: "100%", imageRendering: scale > 2.2 ? "pixelated" : "auto" }}
        />
        {rendering ? (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            rendering…
          </span>
        ) : null}
      </div>

      {/* Overlay: boxes, handles, marquee */}
      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{ transform: `translate3d(${origin.x}px, ${origin.y}px, 0)` }}
      >
        {showBoxes &&
          layers.map((layer) => {
            if (!layer.visible || layer.id === editingId) return null;
            const isSelected = selection.includes(layer.id);
            return (
              <div
                key={layer.id}
                className={cn(
                  "absolute border",
                  layer.kind === "cleanup" && "border-dashed",
                  isSelected
                    ? "border-[var(--color-brand-500)]"
                    : "border-[color-mix(in_srgb,var(--color-brand-500)_45%,transparent)]",
                )}
                style={{
                  left: layer.x * scale,
                  top: layer.y * scale,
                  width: layer.width * scale,
                  height: layer.height * scale,
                  transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                  boxShadow: isSelected ? "0 0 0 1px var(--color-brand-500) inset" : undefined,
                  opacity: layer.visible ? 1 : 0.35,
                }}
              >
                {layer.kind === "cleanup" ? (
                  <span className="absolute -top-4 left-0 rounded bg-[var(--color-brand-600)] px-1.5 text-[9px] font-medium text-white">
                    cleanup
                  </span>
                ) : null}
              </div>
            );
          })}

        {selectedLayers.length && !editingId
          ? selectedLayers.map((layer) => (
              <React.Fragment key={`handles-${layer.id}`}>
                <div
                  className="absolute"
                  style={{
                    left: layer.x * scale,
                    top: layer.y * scale,
                    width: layer.width * scale,
                    height: layer.height * scale,
                    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                  }}
                >
                  {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as HandleId[]).map((handle) => {
                    const rect = { x: 0, y: 0, width: layer.width * scale, height: layer.height * scale };
                    const point = handlePoint(rect, handle);
                    return (
                      <span
                        key={handle}
                        className="absolute bg-white shadow-[0_0_0_1px_var(--color-brand-500)]"
                        style={{
                          left: point.x - HANDLE_SIZE / 2,
                          top: point.y - HANDLE_SIZE / 2,
                          width: HANDLE_SIZE,
                          height: HANDLE_SIZE,
                          borderRadius: handle.length === 2 ? 2 : 999,
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  className="absolute"
                  style={{
                    left: layer.x * scale,
                    top: layer.y * scale,
                    width: layer.width * scale,
                    height: layer.height * scale,
                    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                  }}
                >
                  <span
                    className="absolute left-1/2 size-3 -translate-x-1/2 rounded-full border border-[var(--color-brand-500)] bg-white"
                    style={{ top: -24 - 1, cursor: "grab" }}
                  />
                </div>
              </React.Fragment>
            ))
          : null}

        {marqueeRect ? (
          <div
            className="absolute border border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/12"
            style={{
              left: marqueeRect.x * scale,
              top: marqueeRect.y * scale,
              width: marqueeRect.width * scale,
              height: marqueeRect.height * scale,
            }}
          />
        ) : null}

        {/* Box-size readout while dragging */}
        {interaction.type === "create" || interaction.type === "resize" ? (
          <span
            className="absolute rounded bg-[var(--text)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--surface)]"
            style={{
              left: (interaction.type === "create"
                ? Math.min(interaction.start.x, interaction.current.x)
                : interaction.box.x) * scale,
              top:
                (interaction.type === "create"
                  ? Math.min(interaction.start.y, interaction.current.y)
                  : interaction.box.y) * scale - 20,
            }}
          >
            {interaction.type === "create"
              ? `${Math.round(normalizeRect(interaction.start, interaction.current).width)} × ${Math.round(normalizeRect(interaction.start, interaction.current).height)}`
              : `${Math.round(interaction.box.width)} × ${Math.round(interaction.box.height)}`}
          </span>
        ) : null}
      </div>

      {/* Live text editor for the selected box */}
      {editingLayer ? (
        <TextBoxEditor
          key={editingLayer.id}
          page={page}
          layer={editingLayer}
          scale={scale}
          origin={origin}
          onCommit={commitEditing}
          onExit={() => setEditingId(null)}
        />
      ) : null}

      <BrushCursor
        point={brushCursor}
        scale={scale}
        origin={origin}
        size={brush.size}
        mode={brush.mode}
        visible={
          (tool === "heal" ||
            (brushMode === "on" && tool !== "text" && tool !== "box" && tool !== "pick")) &&
          !editingId
        }
      />
    </div>
  );
}

function cleanupFromRect(rect: Rect) {
  const layer = createCleanupLayer(rect);
  return layer;
}

function layerBox(layer: Layer) {
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
}

/** Used by the inspector to keep auto-fitted text in sync with the box. */
export function measureFittedFontSize(layer: TextLayer, canvas?: HTMLCanvasElement) {
  const target = canvas ?? (typeof document !== "undefined" ? document.createElement("canvas") : null);
  if (!target) return layer.fontSize;
  const ctx = getContext(target);
  return fitFontSizeToBox(ctx, {
    text: layer.text,
    box: { width: layer.width, height: layer.height },
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    italic: layer.italic,
    letterSpacing: layer.letterSpacing,
  });
}

export type { EditorState };
export { fontCss, layerCorners, pointInLayer, renderBase, invalidateBase };
