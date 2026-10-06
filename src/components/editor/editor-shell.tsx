"use client";

import * as React from "react";
import { Loader2, PanelRightClose, PanelRightOpen, Sparkles } from "lucide-react";
import { TopBar, StatusBar, ToolRail } from "./toolbar";
import { PageRail } from "./page-rail";
import { CanvasStage } from "./canvas-stage";
import { Inspector } from "./inspector";
import { Dropzone } from "./dropzone";
import { ExportDialog } from "./export-dialog";
import { useEditor } from "@/lib/editor/store";
import { importFiles, isSupportedImage, isPdf } from "@/lib/editor/documents";
import { jsonToProject, loadProject, projectToJson, saveProject } from "@/lib/editor/project";
import { download } from "@/lib/utils";

export function EditorShell() {
  const pages = useEditor((s) => s.pages);
  const activePageId = useEditor((s) => s.activePageId);
  const loadPages = useEditor((s) => s.loadPages);
  const setStatus = useEditor((s) => s.setStatus);
  const setBusy = useEditor((s) => s.setBusy);
  const busy = useEditor((s) => s.busy);
  const detect = useEditor((s) => s.detect);
  const detection = useEditor((s) => s.detection);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const removeLayers = useEditor((s) => s.removeLayers);
  const duplicateLayers = useEditor((s) => s.duplicateLayers);
  const selection = useEditor((s) => s.selection);
  const setZoom = useEditor((s) => s.setZoom);
  const brush = useEditor((s) => s.brush);
  const setBrush = useEditor((s) => s.setBrush);

  const [exportOpen, setExportOpen] = React.useState(false);
  const [inspectorOpen, setInspectorOpen] = React.useState(true);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importMessage, setImportMessage] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const projectInputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const autoDetectedRef = React.useRef<string | null>(null);

  const activePage = pages.find((page) => page.id === activePageId) ?? null;

  /* ------------------------- import / export ------------------------ */

  const openFiles = React.useCallback(
    async (files: File[]) => {
      const projectFiles = files.filter((file) => /\.json$/i.test(file.name));
      if (projectFiles.length) {
        setBusy({ active: true, label: "Opening project…", progress: 0.2 });
        try {
          const parsed = await jsonToProject(projectFiles[0]);
          loadPages(parsed.pages);
          setStatus(`Opened project “${parsed.name}” (${parsed.pages.length} pages)`);
        } catch (error) {
          setStatus((error as Error).message);
        } finally {
          setBusy(null);
        }
        return;
      }

      const usable = files.filter((file) => isPdf(file) || isSupportedImage(file));
      if (!usable.length) {
        setStatus("Unsupported file type. Use PNG, JPG, WebP, BMP, GIF, AVIF or PDF.");
        return;
      }
      setBusy({ active: true, label: "Importing…", progress: 0.02 });
      setImportProgress(0.02);
      try {
        const { pages: imported, warnings } = await importFiles(usable, {
          onProgress: (message, progress) => {
            setImportMessage(message);
            setImportProgress(progress);
            setBusy({ active: true, label: message, progress });
          },
        });
        if (!imported.length) {
          setStatus(warnings[0] ?? "Nothing could be imported.");
          return;
        }
        if (pages.length === 0) loadPages(imported);
        else useEditor.getState().addPages(imported);
        setStatus(
          `Imported ${imported.length} page${imported.length > 1 ? "s" : ""}` +
            (warnings.length ? ` · ${warnings.length} warning(s)` : ""),
        );
        warnings.forEach((warning) => setStatus(warning));
      } catch (error) {
        setStatus(`Import failed: ${(error as Error).message}`);
      } finally {
        setBusy(null);
        setImportProgress(0);
      }
    },
    [loadPages, pages.length, setBusy, setStatus],
  );

  // Auto-detect text as soon as a fresh page is loaded — this is what makes the
  // "open a file and the boxes are already there" first run feel instant.
  React.useEffect(() => {
    if (!activePage) return;
    if (autoDetectedRef.current === activePage.id) return;
    if (activePage.layers.length > 0) return;
    if (detection.running) return;
    autoDetectedRef.current = activePage.id;
    const handle = window.setTimeout(() => {
      void detect().then((count) => {
        if (count > 0) setStatus(`Auto-detected ${count} text boxes — click any box to edit`);
      });
    }, 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage?.id]);

  const saveProjectToBrowser = React.useCallback(async () => {
    if (!pages.length) return;
    setBusy({ active: true, label: "Saving project…", progress: 0.4 });
    try {
      const name = activePage?.name.replace(/\.[a-z0-9]+$/i, "") || "AeroText project";
      await saveProject(name, pages);
      setStatus("Project saved in this browser (IndexedDB)");
    } catch (error) {
      setStatus(`Save failed: ${(error as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [activePage?.name, pages, setBusy, setStatus]);

  const exportProjectJson = React.useCallback(() => {
    if (!pages.length) return;
    const name = activePage?.name.replace(/\.[a-z0-9]+$/i, "") || "aerotext-project";
    download(projectToJson(name, pages), `${name}.json`);
    setStatus("Project file downloaded");
  }, [activePage?.name, pages, setStatus]);

  /* ---------------------------- shortcuts --------------------------- */

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox");
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setExportOpen(true);
        return;
      }
      if (meta && event.key.toLowerCase() === "o") {
        event.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveProjectToBrowser();
        return;
      }
      if (meta && event.key.toLowerCase() === "a") {
        if (typing) return;
        event.preventDefault();
        useEditor.getState().selectLayers(activePage?.layers.map((layer) => layer.id) ?? []);
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        if (typing || !selection.length) return;
        event.preventDefault();
        duplicateLayers(selection);
        return;
      }
      if (typing) return;

      switch (event.key) {
        case "v":
        case "V":
          setTool("select");
          break;
        case "t":
        case "T":
          setTool("text");
          break;
        case "b":
        case "B":
          setTool("box");
          break;
        case "h":
        case "H":
          setTool(tool === "heal" ? "select" : "heal");
          break;
        case "i":
        case "I":
          setTool("pick");
          break;
        case " ":
          event.preventDefault();
          setTool("pan");
          break;
        case "[":
          setBrush({ size: Math.max(4, brush.size - 4) });
          break;
        case "]":
          setBrush({ size: Math.min(300, brush.size + 4) });
          break;
        case "Delete":
        case "Backspace":
          if (selection.length) {
            event.preventDefault();
            removeLayers(selection);
          }
          break;
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          if (!selection.length || !activePage) return;
          event.preventDefault();
          const step = event.shiftKey ? 10 : 1;
          const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
          const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
          useEditor.getState().mutate((doc) => {
            const page = doc.pages.find((item) => item.id === doc.activePageId);
            if (!page) return;
            page.layers = page.layers.map((layer) =>
              selection.includes(layer.id) ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer,
            );
          });
          break;
        }
        case "Escape":
          useEditor.getState().selectLayers([]);
          setTool("select");
          break;
        case "0":
          if (meta) setZoom(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activePage,
    brush.size,
    duplicateLayers,
    redo,
    removeLayers,
    saveProjectToBrowser,
    selection,
    setBrush,
    setTool,
    setZoom,
    tool,
    undo,
  ]);

  /* -------------------------- alt-click clone ----------------------- */

  React.useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!event.altKey) return;
      const stage = (event.target as HTMLElement)?.closest("[data-stage]") as HTMLElement | null;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const state = useEditor.getState();
      const page = state.pages.find((item) => item.id === state.activePageId);
      if (!page) return;
      const scale = state.fit
        ? Math.min(1, (rect.width - 48) / page.width, (rect.height - 48) / page.height)
        : state.zoom;
      const originX = state.fit ? (rect.width - page.width * scale) / 2 : state.offset.x;
      const originY = state.fit ? (rect.height - page.height * scale) / 2 : state.offset.y;
      const point = {
        x: (event.clientX - rect.left - originX) / scale,
        y: (event.clientY - rect.top - originY) / scale,
      };
      state.setBrush({ source: point, mode: "clone" });
      state.setTool("heal");
      state.setStatus(`Clone source set to ${Math.round(point.x)}, ${Math.round(point.y)}`);
    };
    window.addEventListener("click", handler, true);
    return () => window.removeEventListener("click", handler, true);
  }, []);

  /* ------------------------------- render --------------------------- */

  const hasPages = pages.length > 0;

  return (
    <div
      className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg)]"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length) void openFiles(files);
      }}
    >
      <TopBar
        onOpen={() => fileInputRef.current?.click()}
        onExport={() => setExportOpen(true)}
        onSaveProject={saveProjectToBrowser}
        onExportProject={exportProjectJson}
        onOpenProject={() => projectInputRef.current?.click()}
        detecting={detection.running}
      />

      <div className="flex min-h-0 flex-1">
        {hasPages ? <ToolRail onToggleBrush={() => undefined} /> : null}
        {hasPages ? <PageRail onAddFiles={() => fileInputRef.current?.click()} /> : null}

        <main className="relative min-w-0 flex-1" data-stage>
          {hasPages && activePage ? (
            <>
              <CanvasStage page={activePage} />
              <button
                type="button"
                onClick={() => setInspectorOpen((value) => !value)}
                className="absolute right-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-app glass px-2.5 py-1.5 text-[11.5px] font-medium shadow-sm transition hover:surface-3 lg:hidden"
              >
                {inspectorOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
                {inspectorOpen ? "Hide panel" : "Show panel"}
              </button>
            </>
          ) : (
            <div className="flex size-full items-center justify-center p-4">
              <div className="w-full max-w-2xl">
                <Dropzone
                  onFiles={(files) => void openFiles(files)}
                  busy={Boolean(busy?.active)}
                  progress={importProgress}
                  message={importMessage}
                />
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      title: "1 · Detect",
                      body: "OCR finds every word and builds editable boxes with matched fonts and colours.",
                    },
                    {
                      title: "2 · Replace",
                      body: "Type the new text — the old glyphs are healed out of the pixels underneath.",
                    },
                    {
                      title: "3 · Export",
                      body: "Bake the realistic finish and download PNG, JPEG, WebP or a multi-page PDF.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[var(--radius-md)] border border-app surface p-3">
                      <p className="text-[12.5px] font-semibold">{item.title}</p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const projects = await loadProject("last");
                    if (!projects) setStatus("No saved project in this browser yet.");
                  }}
                  className="sr-only"
                >
                  Load last project
                </button>
              </div>
            </div>
          )}
        </main>

        {hasPages && inspectorOpen ? (
          <div className="hidden w-[330px] shrink-0 lg:block">
            <Inspector onExport={() => setExportOpen(true)} />
          </div>
        ) : null}
      </div>

      {hasPages ? <StatusBar /> : null}

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-app surface px-10 py-8 shadow-[var(--shadow-floating)]">
            <Sparkles className="size-6 text-[var(--color-brand-500)]" />
            <p className="text-[15px] font-semibold">Drop to import</p>
            <p className="text-[12.5px] text-muted">Images and PDF pages become editable canvases</p>
          </div>
        </div>
      ) : null}

      {busy?.active ? (
        <div className="fixed bottom-12 left-1/2 z-[75] -translate-x-1/2 rounded-[var(--radius-md)] border border-app surface px-4 py-2 shadow-[var(--shadow-floating)]">
          <p className="flex items-center gap-2 text-[12.5px]">
            <Loader2 className="size-3.5 animate-spin" />
            {busy.label}
          </p>
        </div>
      ) : null}

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/bmp,image/gif,image/avif,application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void openFiles(files);
          event.target.value = "";
        }}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void openFiles(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
