"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { useEditor } from "@/lib/editor/store";
import { renderThumbnail } from "@/lib/editor/render";
import { duplicatePage } from "@/lib/editor/documents";
import { Tooltip } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

export function PageRail({ onAddFiles }: { onAddFiles: () => void }) {
  const pages = useEditor((s) => s.pages);
  const activePageId = useEditor((s) => s.activePageId);
  const setActivePage = useEditor((s) => s.setActivePage);
  const removePage = useEditor((s) => s.removePage);
  const addPages = useEditor((s) => s.addPages);
  const [collapsed, setCollapsed] = React.useState(false);
  const [thumbs, setThumbs] = React.useState<Record<string, string>>({});

  // Thumbnails are regenerated lazily and cached per page revision.
  const signature = useEditor((s) =>
    s.pages
      .map((page) => `${page.id}:${page.layers.length}:${page.brushBatches.length}`)
      .join("|"),
  );

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      for (const page of pages) {
        if (cancelled) return;
        try {
          const url = await renderThumbnail(page, 132);
          if (cancelled) return;
          setThumbs((current) => (current[page.id] === url ? current : { ...current, [page.id]: url }));
        } catch {
          // thumbnails are best-effort
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (collapsed) {
    return (
      <div className="flex h-full w-9 flex-col items-center gap-2 border-r border-app surface-2 py-2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex size-6 items-center justify-center rounded-[var(--radius-xs)] text-subtle transition hover:surface-3"
          aria-label="Expand page rail"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <span className="font-mono text-[10px] text-subtle">{pages.length}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[132px] flex-col border-r border-app surface-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle">
          Pages · {pages.length}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="inline-flex size-6 items-center justify-center rounded-[var(--radius-xs)] text-subtle transition hover:surface-3"
          aria-label="Collapse page rail"
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {pages.map((page, index) => {
          const active = page.id === activePageId;
          return (
            <div key={page.id} className="group relative">
              <button
                type="button"
                onClick={() => setActivePage(page.id)}
                className={cn(
                  "block w-full overflow-hidden rounded-[var(--radius-sm)] border text-left transition",
                  active
                    ? "border-[var(--color-brand-500)] ring-2 ring-[var(--ring)]"
                    : "border-app hover:border-[var(--border-strong)]",
                )}
              >
                <span className="relative block aspect-[3/4] w-full surface-3">
                  {thumbs[page.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbs[page.id]}
                      alt={`${page.name} preview`}
                      className="size-full object-contain"
                    />
                  ) : (
                    <span className="shimmer absolute inset-0" />
                  )}
                  <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/55 px-1 text-[9.5px] font-medium text-white">
                    {page.kind === "pdf" ? <FileText className="size-2.5" /> : <ImageIcon className="size-2.5" />}
                    {index + 1}
                  </span>
                </span>
                <span className="block truncate px-1.5 py-1 text-[10.5px] text-muted">{page.name}</span>
              </button>

              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                <Tooltip label="Duplicate page">
                  <button
                    type="button"
                    onClick={() => addPages([duplicatePage(page)])}
                    className="rounded bg-black/55 p-1 text-white backdrop-blur transition hover:bg-black/75"
                    aria-label="Duplicate page"
                  >
                    <Copy className="size-3" />
                  </button>
                </Tooltip>
                {pages.length > 1 ? (
                  <Tooltip label="Remove page">
                    <button
                      type="button"
                      onClick={() => removePage(page.id)}
                      className="rounded bg-rose-600/85 p-1 text-white backdrop-blur transition hover:bg-rose-600"
                      aria-label="Remove page"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddFiles}
        className="m-2 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-app px-2 py-1.5 text-[11.5px] font-medium text-muted transition hover:surface-3 hover:text-[var(--text)]"
      >
        <Plus className="size-3.5" /> Add pages
      </button>
    </div>
  );
}
