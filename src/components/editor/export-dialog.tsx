"use client";

import * as React from "react";
import { Clipboard, Download, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Field, ProgressBar, SectionTitle } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { LabeledSlider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/overlays";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditor } from "@/lib/editor/store";
import { copyPageToClipboard, estimateOutputSize, exportPages } from "@/lib/editor/export";
import { EXPORT_FORMATS, SCALE_PRESETS, formatMeta } from "@/lib/editor/formats";
import { download, formatBytes } from "@/lib/utils";

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pages = useEditor((s) => s.pages);
  const activePageId = useEditor((s) => s.activePageId);
  const settings = useEditor((s) => s.exportSettings);
  const setSettings = useEditor((s) => s.setExportSettings);
  const finish = useEditor((s) => s.finish);
  const finishEnabled = useEditor((s) => s.finishEnabled);
  const setStatus = useEditor((s) => s.setStatus);
  const [working, setWorking] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const activePage = pages.find((page) => page.id === activePageId) ?? null;
  const targetPages = settings.pageMode === "all" ? pages : activePage ? [activePage] : [];
  const estimate = activePage ? estimateOutputSize(activePage, settings) : null;
  const meta = formatMeta(settings.format);

  const run = async (action: "download" | "clipboard") => {
    if (!targetPages.length) return;
    setError(null);
    setWorking(action);
    setProgress(0.02);
    try {
      if (action === "clipboard") {
        if (!activePage) return;
        await copyPageToClipboard(activePage, finishEnabled ? finish : null);
        setStatus("Page copied to clipboard");
        onOpenChange(false);
        return;
      }
      const files = await exportPages(targetPages, {
        settings,
        finish: finishEnabled ? finish : null,
        onProgress: ({ index, total }) => setProgress(index / total),
      });
      files.forEach((file, index) => {
        // Small stagger keeps Safari happy when several downloads fire at once.
        setTimeout(() => download(file.blob, file.filename), index * 220);
      });
      setStatus(
        `Exported ${files.length} file${files.length > 1 ? "s" : ""} · ${files[0].width}×${files[0].height}`,
      );
      setProgress(1);
    } catch (caught) {
      const message = (caught as Error).message || "Export failed";
      setError(message);
      setStatus(`Export failed: ${message}`);
    } finally {
      setWorking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,38rem)]">
        <DialogHeader
          title="Export your edit"
          description="The preview and the exported file come from the same renderer, so what you see is what you get."
        />
        <div className="scrollbar-thin max-h-[68dvh] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {EXPORT_FORMATS.map((format) => (
              <button
                key={format.value}
                type="button"
                onClick={() => setSettings({ format: format.value })}
                className={`rounded-[var(--radius-md)] border p-3 text-left transition ${
                  settings.format === format.value
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/8"
                    : "border-app hover:surface-3"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{format.value.toUpperCase()}</span>
                  {format.lossy ? <Badge>lossy</Badge> : <Badge variant="accent">lossless</Badge>}
                </span>
                <span className="mt-1 block text-[11.5px] leading-snug text-muted">{format.blurb}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            <SectionTitle>Output</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pages">
                <Select
                  value={settings.pageMode}
                  onValueChange={(value) => setSettings({ pageMode: value as typeof settings.pageMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">This page only</SelectItem>
                    <SelectItem value="all">All pages ({pages.length})</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="File name">
                <Input
                  value={settings.filename}
                  onChange={(event) => setSettings({ filename: event.target.value })}
                  className="h-8 text-[12.5px]"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              {SCALE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSettings({ scale: preset })}
                  className={`rounded-[var(--radius-sm)] border px-2.5 py-1 text-[12px] transition ${
                    Math.abs(settings.scale - preset) < 0.001
                      ? "border-[var(--color-brand-500)] surface-3"
                      : "border-app hover:surface-3"
                  }`}
                >
                  {preset}×
                </button>
              ))}
            </div>

            <LabeledSlider
              label="Scale"
              valueLabel={`${settings.scale.toFixed(2)}×`}
              min={0.25}
              max={3}
              step={0.05}
              value={[settings.scale]}
              onValueChange={([value]) => setSettings({ scale: value })}
              hint={estimate ? `Result: ${estimate.width} × ${estimate.height} px` : undefined}
            />

            {meta.lossy ? (
              <LabeledSlider
                label="Quality"
                valueLabel={`${Math.round(settings.quality * 100)}%`}
                min={0.3}
                max={1}
                step={0.01}
                value={[settings.quality]}
                onValueChange={([value]) => setSettings({ quality: value })}
              />
            ) : null}
          </div>

          {estimate ? (
            <div className="mt-5 rounded-[var(--radius-md)] border border-app surface-2 p-3 text-[12px] text-muted">
              <div className="flex justify-between">
                <span>Estimated size</span>
                <span className="font-medium text-[var(--text)]">≈ {formatBytes(estimate.bytes)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Pages in export</span>
                <span className="font-medium text-[var(--text)]">{targetPages.length}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Page finish</span>
                <span className="font-medium text-[var(--text)]">
                  {finishEnabled ? "applied" : "off"}
                </span>
              </div>
            </div>
          ) : null}

          {working ? (
            <div className="mt-4 space-y-2">
              <p className="flex items-center gap-2 text-[12.5px] text-muted">
                <Loader2 className="size-3.5 animate-spin" />
                {working === "clipboard" ? "Copying…" : "Rendering pages…"}
              </p>
              <ProgressBar value={progress} />
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-[var(--radius-md)] bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-app px-5 py-3">
          <Button
            variant="ghost"
            onClick={() => void run("clipboard")}
            disabled={Boolean(working) || !activePage}
          >
            <Clipboard className="size-4" /> Copy page
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={Boolean(working)}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={() => void run("download")} disabled={Boolean(working) || !targetPages.length}>
            {working === "download" ? <Loader2 className="size-4 animate-spin" /> : meta.value === "pdf" ? <FileDown className="size-4" /> : <Download className="size-4" />}
            Export {settings.format.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
