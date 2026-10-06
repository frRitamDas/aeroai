"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_BRUSH,
  DEFAULT_EFFECTS,
  DEFAULT_PATCH,
  MAX_HISTORY,
  type BrushSettings,
  type BrushStroke,
  type CleanupLayer,
  type ExportSettings,
  type FontSuggestion,
  type Layer,
  type LayerUpdate,
  type OcrState,
  type Page,
  type TextLayer,
  type ToolId,
} from "./types";
import { DEFAULT_PHOTO_FINISH, invalidateBase, type PhotoFinish } from "./render";
import { buildTextLayers } from "./detect";
import { recognize, type GroupMode } from "./ocr";
import { originalCanvas } from "./detect";
import { clamp, uid } from "@/lib/utils";
import { layerCorners } from "./geometry";

export type InspectorTab = "content" | "style" | "patch" | "effects" | "layers" | "brush" | "export";
export type ThemeMode = "light" | "dark" | "system";

export interface DetectionState {
  running: boolean;
  progress: number;
  message: string;
  language: string;
  group: GroupMode;
  lastRunAt: number | null;
  lastCount: number;
  error: string | null;
}

interface Doc {
  pages: Page[];
  activePageId: string | null;
  selection: string[];
}

export interface EditorState extends Doc {
  past: Doc[];
  future: Doc[];
  historyLabel: string | null;
  tool: ToolId;
  brush: BrushSettings;
  exportSettings: ExportSettings;
  finish: PhotoFinish;
  finishEnabled: boolean;
  detection: DetectionState;
  ocr: OcrState;
  zoom: number;
  offset: { x: number; y: number };
  fit: boolean;
  theme: ThemeMode;
  inspector: InspectorTab;
  showBoxes: boolean;
  showOriginal: boolean;
  brushMode: "off" | "on";
  statusMessage: string | null;
  busy: { active: boolean; label: string; progress: number } | null;

  // document actions
  loadPages: (pages: Page[], options?: { reset?: boolean }) => void;
  addPages: (pages: Page[]) => void;
  removePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  reorderPages: (from: number, to: number) => void;
  setActivePage: (id: string | null) => void;

  // history
  pushHistory: () => void;
  mutate: (fn: (doc: Doc) => void) => void;
  commit: (fn: (doc: Doc) => void) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // layers
  selectLayers: (ids: string[]) => void;
  addLayer: (layer: Layer, options?: { select?: boolean }) => void;
  addLayers: (layers: Layer[]) => void;
  updateLayer: (id: string, patch: LayerUpdate, options?: { record?: boolean }) => void;
  updateLayers: (ids: string[], patch: LayerUpdate) => void;
  updateTextLayer: (id: string, patch: Partial<TextLayer>) => void;
  removeLayers: (ids: string[]) => void;
  duplicateLayers: (ids: string[]) => void;
  reorderLayer: (id: string, direction: "up" | "down" | "front" | "back") => void;
  moveLayers: (ids: string[], dx: number, dy: number) => void;
  setLayerBox: (
    id: string,
    box: { x: number; y: number; width: number; height: number; rotation?: number },
    options?: { record?: boolean },
  ) => void;
  toggleLayerFlag: (id: string, flag: "visible" | "locked") => void;
  applySuggestion: (id: string, suggestion: FontSuggestion) => void;
  clearLayers: () => void;

  // brush
  setBrush: (patch: Partial<BrushSettings>) => void;
  setBrushMode: (mode: "off" | "on") => void;
  addStroke: (stroke: BrushStroke, options?: { record?: boolean }) => void;
  undoStroke: () => void;
  clearStrokes: () => void;

  // detection
  detect: (options?: { group?: GroupMode; language?: string; region?: { x: number; y: number; width: number; height: number } }) => Promise<number>;
  setDetection: (patch: Partial<DetectionState>) => void;
  setOcr: (patch: Partial<OcrState>) => void;

  // view + settings
  setTool: (tool: ToolId) => void;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  setOffset: (offset: { x: number; y: number }) => void;
  setFit: (fit: boolean) => void;
  resetView: () => void;
  setTheme: (theme: ThemeMode) => void;
  setInspector: (tab: InspectorTab) => void;
  setShowBoxes: (value: boolean) => void;
  setShowOriginal: (value: boolean) => void;
  setFinish: (patch: Partial<PhotoFinish>) => void;
  setFinishEnabled: (value: boolean) => void;
  setExportSettings: (patch: Partial<ExportSettings>) => void;
  setStatus: (message: string | null) => void;
  setBusy: (busy: EditorState["busy"]) => void;
}

function cloneLayer(layer: Layer): Layer {
  const base = {
    ...layer,
    patch: { ...layer.patch },
  } as Layer;
  if (base.kind === "text") {
    const text = base as TextLayer;
    return {
      ...text,
      effects: { ...text.effects },
      source: text.source
        ? {
            ...text.source,
            suggestions: text.source.suggestions.map((s) => ({ ...s })),
            stats: text.source.stats ? { ...text.source.stats } : undefined,
          }
        : undefined,
    };
  }
  return base;
}

export function clonePage(page: Page): Page {
  return {
    ...page,
    layers: page.layers.map(cloneLayer),
    brushBatches: page.brushBatches.map((batch) => ({
      ...batch,
      strokes: batch.strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] })),
    })),
  };
}

function cloneDoc(doc: Doc): Doc {
  return {
    pages: doc.pages.map(clonePage),
    activePageId: doc.activePageId,
    selection: [...doc.selection],
  };
}

const EMPTY_OCR: OcrState = {
  status: "idle",
  progress: 0,
  message: "",
  language: "eng",
  lines: 0,
};

const DEFAULT_EXPORT: ExportSettings = {
  format: "png",
  quality: 0.92,
  scale: 1,
  pageMode: "current",
  filename: "aerotext-edit",
};

export const useEditor = create<EditorState>()(
  persist(
    (set, get) => ({
      pages: [],
      activePageId: null,
      selection: [],
      past: [],
      future: [],
      historyLabel: null,
      tool: "select",
      brush: DEFAULT_BRUSH,
      exportSettings: DEFAULT_EXPORT,
      finish: DEFAULT_PHOTO_FINISH,
      finishEnabled: true,
      detection: {
        running: false,
        progress: 0,
        message: "",
        language: "eng",
        group: "line",
        lastRunAt: null,
        lastCount: 0,
        error: null,
      },
      ocr: EMPTY_OCR,
      zoom: 1,
      offset: { x: 0, y: 0 },
      fit: true,
      theme: "system",
      inspector: "content",
      showBoxes: true,
      showOriginal: false,
      brushMode: "off",
      statusMessage: null,
      busy: null,

      loadPages: (pages, options) =>
        set((state) => ({
          pages: options?.reset === false ? [...state.pages, ...pages] : pages,
          activePageId: pages[0]?.id ?? null,
          selection: [],
          past: [],
          future: [],
          fit: true,
          zoom: 1,
          offset: { x: 0, y: 0 },
        })),

      addPages: (pages) =>
        set((state) => ({
          pages: [...state.pages, ...pages],
          activePageId: state.activePageId ?? pages[0]?.id ?? null,
        })),

      removePage: (id) =>
        set((state) => {
          const pages = state.pages.filter((page) => page.id !== id);
          invalidateBase(id);
          return {
            pages,
            activePageId:
              state.activePageId === id ? (pages[0]?.id ?? null) : state.activePageId,
            selection: [],
          };
        }),

      renamePage: (id, name) =>
        set((state) => ({
          pages: state.pages.map((page) => (page.id === id ? { ...page, name } : page)),
        })),

      reorderPages: (from, to) =>
        set((state) => {
          const pages = [...state.pages];
          const [moved] = pages.splice(from, 1);
          if (!moved) return state;
          pages.splice(to, 0, moved);
          return { pages };
        }),

      setActivePage: (id) => set({ activePageId: id, selection: [] }),

      pushHistory: () =>
        set((state) => ({
          past: [...state.past, cloneDoc(docOf(state))].slice(-MAX_HISTORY),
          future: [],
        })),

      mutate: (fn) =>
        set((state) => {
          const doc = cloneDoc(docOf(state));
          fn(doc);
          return { ...doc };
        }),

      commit: (fn) => {
        get().pushHistory();
        get().mutate(fn);
      },

      undo: () =>
        set((state) => {
          const previous = state.past[state.past.length - 1];
          if (!previous) return state;
          return {
            ...cloneDoc(previous),
            past: state.past.slice(0, -1),
            future: [cloneDoc(docOf(state)), ...state.future].slice(0, MAX_HISTORY),
          };
        }),

      redo: () =>
        set((state) => {
          const next = state.future[0];
          if (!next) return state;
          return {
            ...cloneDoc(next),
            future: state.future.slice(1),
            past: [...state.past, cloneDoc(docOf(state))].slice(-MAX_HISTORY),
          };
        }),

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      selectLayers: (ids) => set({ selection: ids }),

      addLayer: (layer, options) => {
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          page.layers.push(layer);
          doc.selection = options?.select === false ? doc.selection : [layer.id];
        });
      },

      addLayers: (layers) =>
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          page.layers.push(...layers);
          doc.selection = layers.map((layer) => layer.id);
        }),

      updateLayer: (id, patch, options) => {
        const apply = (doc: Doc) => {
          const page = activePage(doc);
          if (!page) return;
          const index = page.layers.findIndex((layer) => layer.id === id);
          if (index < 0) return;
          const current = page.layers[index];
          const merged = { ...current, ...patch } as Layer;
          if (current.kind === "text" && merged.kind === "text") {
            const textMerged = merged as TextLayer;
            if (patch.effects) textMerged.effects = { ...current.effects, ...patch.effects };
            if (patch.patch) textMerged.patch = { ...current.patch, ...patch.patch };
          } else if (patch.patch) {
            merged.patch = { ...current.patch, ...patch.patch };
          }
          page.layers[index] = merged;
          if (patch.patch) invalidateBase(page.id);
        };
        if (options?.record === false) get().mutate(apply);
        else get().commit(apply);
      },

      updateLayers: (ids, patch) =>
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          page.layers = page.layers.map((layer) => {
            if (!ids.includes(layer.id)) return layer;
            const merged = { ...layer, ...patch } as Layer;
            if (layer.kind === "text" && merged.kind === "text" && patch.effects) {
              (merged as TextLayer).effects = { ...layer.effects, ...patch.effects };
            }
            if (patch.patch) merged.patch = { ...layer.patch, ...patch.patch };
            return merged;
          });
          if (patch.patch) invalidateBase(page.id);
        }),

      updateTextLayer: (id, patch) =>
        get().commit((doc) => {
          const page = activePage(doc);
          const layer = page?.layers.find((item) => item.id === id);
          if (!layer || layer.kind !== "text") return;
          Object.assign(layer, patch);
        }),

      removeLayers: (ids) =>
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          page.layers = page.layers.filter((layer) => !ids.includes(layer.id));
          doc.selection = doc.selection.filter((id) => !ids.includes(id));
          invalidateBase(page.id);
        }),

      duplicateLayers: (ids) =>
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          const copies = page.layers
            .filter((layer) => ids.includes(layer.id))
            .map((layer) => {
              const copy = cloneLayer(layer);
              copy.id = uid(layer.kind);
              copy.x += 12;
              copy.y += 12;
              copy.name = `${layer.name} copy`;
              return copy;
            });
          page.layers.push(...copies);
          doc.selection = copies.map((copy) => copy.id);
        }),

      reorderLayer: (id, direction) =>
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          const index = page.layers.findIndex((layer) => layer.id === id);
          if (index < 0) return;
          const [layer] = page.layers.splice(index, 1);
          const target =
            direction === "up"
              ? Math.min(page.layers.length, index + 1)
              : direction === "down"
                ? Math.max(0, index - 1)
                : direction === "front"
                  ? page.layers.length
                  : 0;
          page.layers.splice(target, 0, layer);
          if (layer.kind === "cleanup" || layer.patch.enabled) invalidateBase(page.id);
        }),

      moveLayers: (ids, dx, dy) =>
        get().mutate((doc) => {
          const page = activePage(doc);
          if (!page) return;
          page.layers = page.layers.map((layer) =>
            ids.includes(layer.id) ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer,
          );
          if (page.layers.some((layer) => ids.includes(layer.id) && layer.patch.enabled)) {
            invalidateBase(page.id);
          }
        }),

      setLayerBox: (id, box, options) => {
        const apply = (doc: Doc) => {
          const page = activePage(doc);
          if (!page) return;
          const layer = page.layers.find((item) => item.id === id);
          if (!layer) return;
          Object.assign(layer, box);
          if (layer.patch.enabled) invalidateBase(page.id);
        };
        if (options?.record === false) get().mutate(apply);
        else get().commit(apply);
      },

      toggleLayerFlag: (id, flag) => {
        const autoCommit = flag === "visible" || flag === "locked";
        const apply = (doc: Doc) => {
          const page = activePage(doc);
          const layer = page?.layers.find((item) => item.id === id);
          if (!layer) return;
          layer[flag] = !layer[flag];
        };
        if (autoCommit) get().commit(apply);
        else get().mutate(apply);
      },

      applySuggestion: (id, suggestion) =>
        get().commit((doc) => {
          const page = activePage(doc);
          const layer = page?.layers.find((item) => item.id === id);
          if (!layer || layer.kind !== "text") return;
          layer.fontFamily = suggestion.family;
          layer.fontWeight = suggestion.weight;
          layer.italic = suggestion.italic;
        }),

      clearLayers: () =>
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          page.layers = [];
          doc.selection = [];
          invalidateBase(page.id);
        }),

      setBrush: (patch) => set((state) => ({ brush: { ...state.brush, ...patch } })),
      setBrushMode: (mode) => set({ brushMode: mode }),

      addStroke: (stroke, options) => {
        const apply = (doc: Doc) => {
          const page = activePage(doc);
          if (!page) return;
          const last = page.brushBatches[page.brushBatches.length - 1];
          if (last && last.revision === -1) {
            last.strokes.push(stroke);
            last.revision = Date.now();
          } else {
            page.brushBatches.push({ id: uid("batch"), strokes: [stroke], revision: Date.now() });
          }
        };
        if (options?.record === false) get().mutate(apply);
        else get().commit(apply);
      },

      undoStroke: () =>
        get().mutate((doc) => {
          const page = activePage(doc);
          const last = page?.brushBatches[page.brushBatches.length - 1];
          if (!last) return;
          last.strokes.pop();
          last.revision = Date.now();
        }),

      clearStrokes: () =>
        get().commit((doc) => {
          const page = activePage(doc);
          if (!page) return;
          page.brushBatches = [];
        }),

      detect: async (options) => {
        const state = get();
        const page = state.pages.find((item) => item.id === state.activePageId);
        if (!page) return 0;
        const language = options?.language ?? state.detection.language;
        const group = options?.group ?? state.detection.group;
        set({
          detection: {
            ...state.detection,
            running: true,
            progress: 0.02,
            message: "Preparing…",
            language,
            group,
            error: null,
          },
          ocr: { ...EMPTY_OCR, status: "loading", message: "Preparing OCR…", language },
        });

        try {
          // Recognise from the decoded canvas (never from the data URL): the
          // same pixels are then used for colour/structure analysis below, so
          // box coordinates line up exactly with what the healer will edit.
          const base = await originalCanvas(page);
          const lines = await recognize(
            base,
            {
              language,
              region: options?.region,
              onProgress: (progress) => {
                get().setDetection({
                  progress: 0.05 + progress.progress * 0.75,
                  message: progress.message,
                });
                get().setOcr({
                  status: progress.status,
                  progress: progress.progress,
                  message: progress.message,
                });
              },
            },
          );

          get().setDetection({ progress: 0.85, message: "Matching fonts…" });
          const { layers, skipped } = buildTextLayers(lines, {
            base,
            group,
            onProgress: ({ index, total }) =>
              get().setDetection({
                progress: 0.85 + (index / total) * 0.14,
                message: `Matching fonts ${index}/${total}`,
              }),
          });

          if (layers.length) get().addLayers(layers);
          set((current) => ({
            detection: {
              ...current.detection,
              running: false,
              progress: 1,
              message: layers.length
                ? `Detected ${layers.length} text boxes${skipped ? ` (${skipped} skipped)` : ""}`
                : "No editable text found — try manual boxes",
              lastCount: layers.length,
              lastRunAt: Date.now(),
            },
            ocr: {
              ...current.ocr,
              status: "done",
              progress: 1,
              lines: layers.length,
              message: `Found ${layers.length} text lines`,
            },
          }));
          return layers.length;
        } catch (error) {
          const message = (error as Error).message || "OCR failed";
          set((current) => ({
            detection: {
              ...current.detection,
              running: false,
              progress: 0,
              error: message,
              message,
            },
            ocr: { ...current.ocr, status: "error", lastError: message, message },
          }));
          return 0;
        }
      },

      setDetection: (patch) => set((state) => ({ detection: { ...state.detection, ...patch } })),
      setOcr: (patch) => set((state) => ({ ocr: { ...state.ocr, ...patch } })),

      setTool: (tool) => set({ tool, brushMode: tool === "heal" ? "on" : "off" }),
      setZoom: (zoom) => set({ zoom: clamp(zoom, 0.05, 8), fit: false }),
      zoomBy: (factor) => set((state) => ({ zoom: clamp(state.zoom * factor, 0.05, 8), fit: false })),
      setOffset: (offset) => set({ offset }),
      setFit: (fit) => set({ fit }),
      resetView: () => set({ zoom: 1, offset: { x: 0, y: 0 }, fit: true }),
      setTheme: (theme) => set({ theme }),
      setInspector: (tab) => set({ inspector: tab }),
      setShowBoxes: (value) => set({ showBoxes: value }),
      setShowOriginal: (value) => set({ showOriginal: value }),
      setFinish: (patch) => set((state) => ({ finish: { ...state.finish, ...patch } })),
      setFinishEnabled: (value) => set({ finishEnabled: value }),
      setExportSettings: (patch) =>
        set((state) => ({ exportSettings: { ...state.exportSettings, ...patch } })),
      setStatus: (message) => set({ statusMessage: message }),
      setBusy: (busy) => set({ busy }),
    }),
    {
      name: "aerotext-preferences",
      partialize: (state) => ({
        theme: state.theme,
        brush: state.brush,
        finish: state.finish,
        finishEnabled: state.finishEnabled,
        exportSettings: state.exportSettings,
        showBoxes: state.showBoxes,
        tool: state.tool,
        detection: { ...state.detection, running: false, progress: 0, message: "" },
      }),
      version: 1,
    },
  ),
);

function docOf(state: Doc): Doc {
  return { pages: state.pages, activePageId: state.activePageId, selection: state.selection };
}

function activePage(doc: Doc): Page | null {
  return doc.pages.find((page) => page.id === doc.activePageId) ?? null;
}

// --- convenience selectors -------------------------------------------------

export function selectActivePage(state: EditorState): Page | null {
  return state.pages.find((page) => page.id === state.activePageId) ?? null;
}

export function selectSelectedLayers(state: EditorState): Layer[] {
  const page = selectActivePage(state);
  if (!page) return [];
  return page.layers.filter((layer) => state.selection.includes(layer.id));
}

/** Bounding box of the current selection in document space. */
export function selectionBounds(layers: Layer[]) {
  if (!layers.length) return null;
  const points = layers.flatMap((layer) => layerCorners(layer));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function createTextLayerFromBox(
  box: { x: number; y: number; width: number; height: number },
  overrides: Partial<TextLayer> = {},
): TextLayer {
  const fontSize = Math.max(8, Math.round(box.height * 0.72));
  return {
    id: uid("txt"),
    kind: "text",
    name: overrides.text?.slice(0, 24) || "New text",
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    visible: true,
    locked: false,
    text: overrides.text ?? "New text",
    fontFamily: "Inter",
    fontSize,
    fontWeight: 400,
    italic: false,
    underline: false,
    align: "left",
    color: "#111111",
    opacity: 1,
    letterSpacing: 0,
    lineHeight: 1.18,
    autoFit: true,
    effects: { ...DEFAULT_EFFECTS },
    patch: { ...DEFAULT_PATCH, enabled: false },
    ...overrides,
  };
}

export function createCleanupLayer(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): CleanupLayer {
  return {
    id: uid("cln"),
    kind: "cleanup",
    name: "Cleanup",
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    visible: true,
    locked: false,
    patch: { ...DEFAULT_PATCH, mask: "auto" },
  };
}
