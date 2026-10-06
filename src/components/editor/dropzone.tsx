"use client";

import * as React from "react";
import {
  FileImage,
  FileText,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function Dropzone({
  onFiles,
  busy,
  progress,
  message,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  progress?: number;
  message?: string;
  compact?: boolean;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed text-center transition",
        dragging
          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/8"
          : "border-app surface-2",
        compact ? "gap-2 p-6" : "gap-3 p-10",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/bmp,image/gif,image/avif,application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />

      <span className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-accent-500)] text-white shadow-sm">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
      </span>

      <div className="space-y-1">
        <h2 className={cn("font-semibold", compact ? "text-[15px]" : "text-lg")}>
          {busy ? "Preparing your document…" : "Drop an image or PDF here"}
        </h2>
        <p className="mx-auto max-w-md text-[12.5px] leading-relaxed text-muted">
          {busy
            ? message || "Rasterising pages…"
            : "PNG, JPG, WebP, BMP, GIF, AVIF and PDF. Multi-page PDFs become editable pages. Nothing is uploaded — everything is processed in this tab."}
        </p>
      </div>

      {busy && typeof progress === "number" ? (
        <div className="h-1.5 w-56 overflow-hidden rounded-full surface-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand-500)] to-[var(--color-accent-500)] transition-[width] duration-200"
            style={{ width: `${Math.max(4, Math.min(100, progress * 100))}%` }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button variant="gradient" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus className="size-4" /> Choose files
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json,application/json";
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) onFiles([file]);
            };
            input.click();
          }}
          disabled={busy}
        >
          <FileText className="size-4" /> Open project
        </Button>
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11.5px] text-subtle">
          <Badge variant="accent">
            <ShieldCheck className="size-3" /> 100% on-device
          </Badge>
          <Badge variant="outline">
            <FileImage className="size-3" /> 24MP guard
          </Badge>
          <Badge variant="outline">
            <Sparkles className="size-3" /> Auto text detection
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
