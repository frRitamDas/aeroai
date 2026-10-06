"use client";

import * as React from "react";
import { fontCss, fontStack, fitFontSizeToBox } from "@/lib/editor/fonts";
import { useEditor } from "@/lib/editor/store";
import { getContext } from "@/lib/editor/image";
import type { Page, TextLayer } from "@/lib/editor/types";

/**
 * In-place text editor. Renders an overlay that matches the layer's typography
 * 1:1 (same font stack, size, colour, spacing) so what you type is what the
 * rasteriser will paint. Enter inserts a line break, Esc finishes the box.
 */
export function TextBoxEditor({
  page,
  layer,
  scale,
  origin,
  onCommit,
  onExit,
}: {
  page: Page;
  layer: TextLayer;
  scale: number;
  origin: { x: number; y: number };
  onCommit: () => void;
  onExit: () => void;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = React.useState(layer.text);
  const updateLayer = useEditor((s) => s.updateLayer);
  const setStatus = useEditor((s) => s.setStatus);

  // The editor is mounted with a per-layer `key`, so the initial draft is
  // always the layer's current text — this effect only focuses the field.
  React.useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [layer.id]);

  const fitted = React.useMemo(() => {
    if (!layer.autoFit) return layer.fontSize;
    const canvas = document.createElement("canvas");
    const ctx = getContext(canvas);
    return fitFontSizeToBox(ctx, {
      text: draft || " ",
      box: { width: layer.width, height: layer.height },
      fontFamily: layer.fontFamily,
      fontWeight: layer.fontWeight,
      italic: layer.italic,
      letterSpacing: layer.letterSpacing,
      max: Math.max(layer.height * 1.6, 24),
    });
  }, [draft, layer.autoFit, layer.fontSize, layer.fontFamily, layer.height, layer.italic, layer.letterSpacing, layer.width, layer.fontWeight]);

  // Persist the text (live) and the fitted size so the raster matches the overlay.
  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      updateLayer(layer.id, { text: draft, fontSize: fitted }, { record: false });
    }, 120);
    return () => window.clearTimeout(handle);
  }, [draft, fitted, layer.id, updateLayer]);

  // Live typing is written with `record: false`; the history snapshot for the
  // whole session was taken when editing began, so undo restores the original
  // text in one step instead of character by character.
  const commit = () => {
    onCommit();
  };

  return (
    <div
      className="absolute z-30"
      style={{
        left: origin.x + layer.x * scale,
        top: origin.y + layer.y * scale,
        width: layer.width * scale,
        height: layer.height * scale,
        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
      }}
    >
      <textarea
        ref={textareaRef}
        value={draft}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        className="size-full resize-none overflow-hidden rounded-[2px] border border-[var(--color-brand-500)] bg-transparent p-0 leading-[1.18] outline-none ring-2 ring-[var(--color-brand-500)]/25"
        style={{
          font: fontCss(layer, { size: fitted * scale }),
          fontFamily: fontStack(layer.fontFamily),
          color: layer.color,
          letterSpacing: `${layer.letterSpacing * fitted * scale}px`,
          textAlign: layer.align,
          textDecoration: layer.underline ? "underline" : "none",
          opacity: layer.opacity,
          caretColor: layer.color,
          whiteSpace: "pre-wrap",
          background: "transparent",
        }}
      />
      <span
        className="pointer-events-none absolute -bottom-6 left-0 whitespace-nowrap rounded bg-[var(--text)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--surface)]"
        aria-hidden
      >
        {Math.round(fitted)}px · {layer.fontFamily}
        {layer.autoFit ? " · auto-fit" : ""} · Esc to finish
      </span>
      <span className="sr-only" aria-live="polite">
        Editing text box on {page.name}. Press Escape to finish.
        <button type="button" onClick={onExit} className="sr-only">
          Finish editing
        </button>
      </span>
      {(() => {
        void setStatus;
        return null;
      })()}
    </div>
  );
}
