"use client";

import * as React from "react";
import Link from "next/link";
import {
  Brush,
  Copy,
  Crop,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FolderOpen,
  Grid2x2,
  Hand,
  Info,
  Layers,
  MousePointer2,
  Pipette,
  Redo2,
  Save,
  ScanText,
  Sparkles,
  SquareDashed,
  Type,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Kbd, Spinner } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from "@/components/ui/overlays";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useEditor } from "@/lib/editor/store";
import { OCR_LANGUAGES, type ToolId } from "@/lib/editor/types";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolId; icon: React.ElementType; label: string; shortcut: string; hint: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select", shortcut: "V", hint: "Move, resize and rotate text boxes" },
  { id: "text", icon: Type, label: "Text box", shortcut: "T", hint: "Draw a new editable text box" },
  { id: "box", icon: SquareDashed, label: "Cleanup box", shortcut: "B", hint: "Erase whatever is inside the box" },
  { id: "heal", icon: Brush, label: "Heal brush", shortcut: "H", hint: "Clone / blur / colour brush for leftovers" },
  { id: "pick", icon: Pipette, label: "Colour picker", shortcut: "I", hint: "Sample a colour from the image" },
  { id: "pan", icon: Hand, label: "Pan", shortcut: "Space", hint: "Move the canvas around" },
];

export function ToolRail({ onToggleBrush }: { onToggleBrush: () => void }) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const brushMode = useEditor((s) => s.brushMode);
  const clearStrokes = useEditor((s) => s.clearStrokes);
  const hasStrokes = useEditor((s) => (s.pages.find((p) => p.id === s.activePageId)?.brushBatches.length ?? 0) > 0);

  return (
    <div className="flex h-full w-12 flex-col items-center gap-1 border-r border-app surface-2 py-2">
      {TOOLS.map(({ id, icon: Icon, label, shortcut, hint }) => {
        if (id === "heal") {
          return (
            <Tooltip key={id} label={hint} shortcut={shortcut} side="right">
              <button
                type="button"
                onClick={() => {
                  if (tool === "heal" && brushMode === "on") {
                    onToggleBrush();
                    setTool("select");
                  } else {
                    setTool("heal");
                    onToggleBrush();
                  }
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-[var(--radius-sm)] transition",
                  tool === "heal" && brushMode === "on"
                    ? "bg-[var(--color-brand-500)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:surface-3 hover:text-[var(--text)]",
                )}
                aria-label={label}
                aria-pressed={tool === "heal" && brushMode === "on"}
              >
                <Icon className="size-4" />
              </button>
            </Tooltip>
          );
        }
        return (
          <Tooltip key={id} label={hint} shortcut={shortcut} side="right">
            <button
              type="button"
              onClick={() => setTool(id)}
              className={cn(
                "flex size-9 items-center justify-center rounded-[var(--radius-sm)] transition",
                tool === id
                  ? "bg-[var(--color-brand-500)] text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:surface-3 hover:text-[var(--text)]",
              )}
              aria-label={label}
              aria-pressed={tool === id}
            >
              <Icon className="size-4" />
            </button>
          </Tooltip>
        );
      })}

      <div className="my-1 h-px w-6 bg-[var(--border)]" />

      <Tooltip label="Clear all brush strokes" side="right">
        <button
          type="button"
          onClick={clearStrokes}
          disabled={!hasStrokes}
          className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition hover:surface-3 hover:text-[var(--text)] disabled:opacity-35"
          aria-label="Clear brush strokes"
        >
          <Crop className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}

export function TopBar({
  onOpen,
  onExport,
  onSaveProject,
  onOpenProject,
  onExportProject,
  detecting,
}: {
  onOpen: () => void;
  onExport: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onExportProject: () => void;
  detecting: boolean;
}) {
  const detection = useEditor((s) => s.detection);
  const ocr = useEditor((s) => s.ocr);
  const setDetection = useEditor((s) => s.setDetection);
  const detect = useEditor((s) => s.detect);
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const showBoxes = useEditor((s) => s.showBoxes);
  const setShowBoxes = useEditor((s) => s.setShowBoxes);
  const showOriginal = useEditor((s) => s.showOriginal);
  const setShowOriginal = useEditor((s) => s.setShowOriginal);
  const setInspector = useEditor((s) => s.setInspector);
  const inspector = useEditor((s) => s.inspector);

  const layerCount = page?.layers.length ?? 0;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-app surface px-2 sm:px-3">
      <Link href="/" className="flex items-center gap-2 pr-1" title="Back to home">
        <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-accent-500)] text-white">
          <Sparkles className="size-4" />
        </span>
        <span className="hidden text-[13px] font-semibold tracking-tight sm:block">AeroText</span>
      </Link>

      <Button variant="subtle" size="sm" onClick={onOpen}>
        <FolderOpen className="size-3.5" /> Open
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Project menu">
            <Info className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onSaveProject}>
            <Save /> Save project to this browser
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenProject}>
            <FolderOpen /> Open .json project
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportProject}>
            <FileDown /> Download .json project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setShowBoxes(!showBoxes)}>
            {showBoxes ? <EyeOff /> : <Eye />} {showBoxes ? "Hide" : "Show"} detection boxes
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowOriginal(!showOriginal)}>
            <Grid2x2 /> {showOriginal ? "Exit" : "Show"} original
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />

      <div className="flex items-center gap-1">
        <Tooltip label="Undo" shortcut="⌘Z">
          <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <Undo2 className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip label="Redo" shortcut="⌘⇧Z">
          <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <Redo2 className="size-4" />
          </Button>
        </Tooltip>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-[var(--border)] md:block" />

      {/* Detection controls */}
      <div className="flex items-center gap-2">
        <Select
          value={detection.group}
          onValueChange={(value) => setDetection({ group: value as "word" | "line" | "block" })}
        >
          <SelectTrigger className="hidden w-[104px] sm:flex" aria-label="Detection grouping">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="word">By word</SelectItem>
            <SelectItem value="line">By line</SelectItem>
            <SelectItem value="block">By paragraph</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={detection.language}
          onValueChange={(value) => setDetection({ language: value })}
        >
          <SelectTrigger className="hidden w-[132px] md:flex" aria-label="OCR language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {OCR_LANGUAGES.map((language) => (
              <SelectItem key={language.code} value={language.code}>
                {language.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="gradient"
          size="sm"
          onClick={() => void detect()}
          disabled={detecting || !page}
          title="Detect text on this page"
        >
          {detecting ? <Spinner className="size-3.5" /> : <ScanText className="size-3.5" />}
          <span className="hidden sm:inline">{detecting ? "Detecting…" : "Detect text"}</span>
        </Button>
        {detecting ? (
          <span className="hidden max-w-[9rem] truncate text-[11px] text-subtle lg:block">
            {ocr.message || detection.message}
          </span>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip label={showBoxes ? "Hide boxes" : "Show boxes"}>
          <Button
            variant={showBoxes ? "subtle" : "ghost"}
            size="icon"
            onClick={() => setShowBoxes(!showBoxes)}
            aria-label="Toggle detection boxes"
          >
            <Grid2x2 className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip label="Compare with original (hold)">
          <Button
            variant={showOriginal ? "subtle" : "ghost"}
            size="icon"
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => showOriginal && setShowOriginal(false)}
            aria-label="Show original"
          >
            <Eye className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip label="Toggle layers panel" shortcut="L">
          <Button
            variant={inspector === "layers" ? "subtle" : "ghost"}
            size="icon"
            onClick={() => setInspector(inspector === "layers" ? "content" : "layers")}
            aria-label="Layers"
          >
            <Layers className="size-4" />
          </Button>
        </Tooltip>
        <span className="hidden items-center gap-2 rounded-[var(--radius-sm)] surface-3 px-2 py-1 text-[11px] text-muted lg:flex">
          <span>{layerCount} layers</span>
          {page ? (
            <span className="font-mono">
              {page.width}×{page.height}
            </span>
          ) : null}
        </span>
        <ThemeToggle compact />
        <Button variant="outline" size="sm" onClick={onExport} disabled={!page}>
          <Download className="size-3.5" /> Export
        </Button>
      </div>
    </header>
  );
}

export function StatusBar() {
  const statusMessage = useEditor((s) => s.statusMessage);
  const detection = useEditor((s) => s.detection);
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const selection = useEditor((s) => s.selection);
  const zoom = useEditor((s) => s.zoom);
  const fit = useEditor((s) => s.fit);
  const setFit = useEditor((s) => s.setFit);
  const zoomBy = useEditor((s) => s.zoomBy);
  const resetView = useEditor((s) => s.resetView);

  const zoomLabel = fit ? "Fit" : `${Math.round(zoom * 100)}%`;

  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-app surface px-3 text-[11.5px] text-muted">
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        {detection.running ? (
          <>
            <Spinner className="size-3" />
            <span className="truncate">{detection.message}</span>
          </>
        ) : (
          <span className="truncate">{statusMessage ?? detection.message ?? "Ready"}</span>
        )}
      </span>

      <span className="ml-auto flex items-center gap-2">
        {selection.length ? (
          <Badge variant="brand">
            {selection.length} selected
          </Badge>
        ) : null}
        {page?.pdfPage ? (
          <Badge variant="outline">
            <FileDown className="size-2.5" /> PDF page {page.pdfPage}/{page.pdfPageCount}
          </Badge>
        ) : null}
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>⌘</Kbd>
          <span>+ scroll to zoom</span>
        </span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="iconSm" onClick={() => zoomBy(0.85)} aria-label="Zoom out">
            <ZoomOut className="size-3.5" />
          </Button>
          <button
            type="button"
            onClick={() => resetView()}
            className="min-w-[3.2rem] rounded-[var(--radius-xs)] px-1.5 py-1 font-mono text-[11px] transition hover:surface-3"
            title="Reset view"
          >
            {zoomLabel}
          </button>
          <Button variant="ghost" size="iconSm" onClick={() => zoomBy(1.18)} aria-label="Zoom in">
            <ZoomIn className="size-3.5" />
          </Button>
          <Button
            variant={fit ? "subtle" : "ghost"}
            size="iconSm"
            onClick={() => setFit(true)}
            aria-label="Fit to screen"
            title="Fit to screen"
          >
            <Wand2 className="size-3.5" />
          </Button>
        </div>
        <span className="hidden items-center gap-1 lg:flex">
          <Copy className="size-3" /> autosaved locally
        </span>
      </span>
    </footer>
  );
}
