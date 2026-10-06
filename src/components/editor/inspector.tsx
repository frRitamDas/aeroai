"use client";

import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bolt,
  Brush,
  Check,
  Copy,
  Eye,
  EyeOff,
  Italic,
  Layers as LayersIcon,
  Lock,
  RotateCcw,
  Sparkles,
  Trash2,
  Underline,
  Unlock,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Field, Kbd, ProgressBar, ScrollArea, SectionTitle } from "@/components/ui/misc";
import { ColorField, Input, Label, Textarea } from "@/components/ui/input";
import { LabeledSlider } from "@/components/ui/slider";
import { Switch, SwitchField } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlays";
import { FontPicker } from "./font-picker";
import { useEditor, type InspectorTab } from "@/lib/editor/store";
import { ensureFont } from "@/lib/editor/fonts";
import { cn, formatBytes } from "@/lib/utils";
import { estimateOutputSize } from "@/lib/editor/export";
import { DEFAULT_EFFECTS, type TextEffects, type TextLayer } from "@/lib/editor/types";
import { EXPORT_FORMATS } from "@/lib/editor/formats";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "style", label: "Style" },
  { id: "patch", label: "Remove" },
  { id: "effects", label: "Finish" },
  { id: "layers", label: "Layers" },
];

export function Inspector({ onExport }: { onExport: () => void }) {
  const inspector = useEditor((s) => s.inspector);
  const setInspector = useEditor((s) => s.setInspector);
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const selection = useEditor((s) => s.selection);
  const selectedText = React.useMemo(
    () =>
      (page?.layers.find(
        (layer) => layer.id === selection[0] && layer.kind === "text",
      ) as TextLayer | undefined) ?? null,
    [page?.layers, selection],
  );

  const tabs = inspector === "brush" || inspector === "export" ? TABS : TABS;

  return (
    <aside className="flex h-full w-full flex-col border-l border-app surface">
      <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-app px-2 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setInspector(tab.id)}
            className={cn(
              "shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-medium transition",
              inspector === tab.id
                ? "surface-3 text-[var(--text)]"
                : "text-[var(--text-muted)] hover:surface-3 hover:text-[var(--text)]",
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setInspector("brush")}
          className={cn(
            "ml-auto shrink-0 rounded-[var(--radius-sm)] px-2 py-1.5 transition",
            inspector === "brush" ? "surface-3 text-[var(--text)]" : "text-subtle hover:surface-3",
          )}
          aria-label="Brush settings"
        >
          <Brush className="size-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {inspector === "content" ? <ContentTab onExport={onExport} /> : null}
          {inspector === "style" && selectedText ? <StyleTab layer={selectedText} /> : null}
          {inspector === "style" && !selectedText ? (
            <EmptyState
              icon={<Sparkles />}
              title="Select a text box"
              description="Text styling controls appear here once a detected or manual text box is selected."
            />
          ) : null}
          {inspector === "patch" ? <PatchTab /> : null}
          {inspector === "effects" ? <EffectsTab /> : null}
          {inspector === "layers" ? <LayersTab /> : null}
          {inspector === "brush" ? <BrushTab /> : null}
          {inspector === "export" ? <ExportTab onExport={onExport} /> : null}
        </div>
      </ScrollArea>
    </aside>
  );
}

/* ----------------------------- Content ----------------------------- */

function ContentTab({ onExport }: { onExport: () => void }) {
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const selection = useEditor((s) => s.selection);
  const detection = useEditor((s) => s.detection);
  const setInspector = useEditor((s) => s.setInspector);
  const detect = useEditor((s) => s.detect);
  const updateLayer = useEditor((s) => s.updateLayer);
  const applySuggestion = useEditor((s) => s.applySuggestion);
  const layers = page?.layers ?? [];
  const selected = selection
    .map((id) => layers.find((layer) => layer.id === id))
    .filter(Boolean) as TextLayer[];

  if (!selected.length) {
    const textLayers = layers.filter((layer) => layer.kind === "text");
    return (
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-app surface-2 p-3">
          <SectionTitle action={<Badge variant={detection.running ? "brand" : "outline"}>{detection.running ? "running" : "idle"}</Badge>}>
            This page
          </SectionTitle>
          <dl className="mt-2 space-y-1 text-[12.5px]">
            <div className="flex justify-between">
              <dt className="text-subtle">Text boxes</dt>
              <dd className="font-medium">{textLayers.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-subtle">Cleanup patches</dt>
              <dd className="font-medium">
                {layers.filter((layer) => layer.kind === "cleanup").length}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-subtle">Resolution</dt>
              <dd className="font-mono text-[11.5px]">
                {page ? `${page.width}×${page.height}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-subtle">Source</dt>
              <dd className="font-medium">
                {page?.kind === "pdf" ? `PDF p${page.pdfPage}` : "image"}
              </dd>
            </div>
          </dl>
        </div>

        <Button
          variant="gradient"
          className="w-full"
          onClick={() => void detect()}
          disabled={detection.running || !page}
        >
          <Wand2 className="size-4" />
          {detection.running ? "Detecting text…" : "Detect text on this page"}
        </Button>
        {detection.running ? <ProgressBar value={detection.progress} /> : null}
        {detection.message ? (
          <p className="text-[11.5px] leading-relaxed text-subtle">{detection.message}</p>
        ) : null}

        <div className="rounded-[var(--radius-md)] border border-app surface-2 p-3 text-[12px] leading-relaxed text-muted">
          <p className="mb-1 font-medium text-[var(--text)]">Quick tips</p>
          <ul className="space-y-1">
            <li>• Press <strong>T</strong> to draw a text box manually.</li>
            <li>• Press <strong>B</strong> for a cleanup box that erases what is inside.</li>
            <li>• Double-click any box to type a replacement.</li>
            <li>• Hold the eye button in the top bar to compare with the original.</li>
          </ul>
        </div>

        <Button variant="outline" className="w-full" onClick={onExport} disabled={!page}>
          Export this page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selected.map((layer) => (
        <div key={layer.id} className="space-y-3 rounded-[var(--radius-md)] border border-app surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Text content</SectionTitle>
            {layer.source ? (
              <Tooltip label={`OCR confidence ${Math.round(layer.source.confidence)}%`}>
                <Badge variant={layer.source.confidence > 80 ? "accent" : "default"}>
                  {Math.round(layer.source.confidence)}%
                </Badge>
              </Tooltip>
            ) : null}
          </div>

          <Textarea
            value={layer.text}
            rows={Math.min(6, Math.max(2, layer.text.split("\n").length + 1))}
            onChange={(event) => updateLayer(layer.id, { text: event.target.value }, { record: false })}
            onFocus={() => useEditor.getState().pushHistory()}
            className="font-sans"
            placeholder="Type the replacement text…"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!layer.source}
              onClick={() =>
                layer.source
                  ? updateLayer(layer.id, { text: layer.source.original }, { record: true })
                  : undefined
              }
            >
              <RotateCcw className="size-3.5" /> Restore original
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(layer.text);
                useEditor.getState().setStatus("Text copied");
              }}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
            <Tooltip label="Toggle auto-fit to box">
              <Button
                size="sm"
                variant={layer.autoFit ? "subtle" : "outline"}
                onClick={() => updateLayer(layer.id, { autoFit: !layer.autoFit })}
              >
                <Bolt className="size-3.5" /> Auto-fit
              </Button>
            </Tooltip>
          </div>

          <SizeRow layer={layer} />

          <div className="flex items-center justify-between gap-2">
            <Label>Alignment</Label>
            <div className="flex gap-1">
              {(
                [
                  { value: "left", icon: AlignLeft },
                  { value: "center", icon: AlignCenter },
                  { value: "right", icon: AlignRight },
                ] as const
              ).map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateLayer(layer.id, { align: value })}
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)] transition",
                    layer.align === value
                      ? "surface text-[var(--text)] shadow-sm"
                      : "text-subtle hover:surface-3",
                  )}
                  aria-label={`Align ${value}`}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </div>

          {layer.source?.suggestions?.length ? (
            <div className="space-y-1.5">
              <SectionTitle>Matched fonts</SectionTitle>
              {layer.source.suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.family}-${suggestion.weight}`}
                  type="button"
                  onMouseEnter={() => void ensureFont(suggestion.family, suggestion.weight, suggestion.italic)}
                  onClick={() => {
                    void ensureFont(suggestion.family, suggestion.weight, suggestion.italic);
                    applySuggestion(layer.id, suggestion);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2 text-left transition",
                    layer.fontFamily === suggestion.family
                      ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/8"
                      : "border-app hover:surface-3",
                  )}
                >
                  <span className="min-w-0">
                    <span
                      className="block truncate text-[13px] font-medium"
                      style={{ fontFamily: `"${suggestion.family}", sans-serif` }}
                    >
                      {suggestion.family}
                    </span>
                    <span className="block truncate text-[10.5px] text-subtle">
                      {suggestion.weight} · {suggestion.reason}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-subtle">
                      {Math.round(suggestion.score * 100)}%
                    </span>
                    {layer.fontFamily === suggestion.family ? (
                      <Check className="size-3.5 text-[var(--color-brand-500)]" />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {layer.source?.stats ? (
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-subtle">
              <span>stroke ratio: {layer.source.stats.strokeRatio.toFixed(3)}</span>
              <span>slant: {layer.source.stats.slant.toFixed(1)}°</span>
              <span>serif score: {layer.source.stats.serifScore.toFixed(2)}</span>
              <span>ink ratio: {(layer.source.stats.inkRatio * 100).toFixed(1)}%</span>
            </div>
          ) : null}

          <Button variant="ghost" size="sm" className="w-full" onClick={() => setInspector("patch")}>
            Removal settings →
          </Button>
        </div>
      ))}
    </div>
  );
}

function SizeRow({ layer }: { layer: TextLayer }) {
  const updateLayer = useEditor((s) => s.updateLayer);
  return (
    <div className="flex items-end gap-2">
      <Field label="Size (px)" className="flex-1">
        <Input
          type="number"
          min={4}
          max={800}
          value={Math.round(layer.fontSize)}
          onChange={(event) =>
            updateLayer(layer.id, { fontSize: Number(event.target.value) || 12, autoFit: false }, { record: false })
          }
          onFocus={() => useEditor.getState().pushHistory()}
          className="h-8 font-mono text-[12px]"
        />
      </Field>
      <div className="flex gap-1 pb-0.5">
        <button
          type="button"
          onClick={() => updateLayer(layer.id, { fontWeight: layer.fontWeight >= 700 ? 400 : 700 })}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-app text-[13px] font-bold transition",
            layer.fontWeight >= 700 ? "surface-3 text-[var(--text)]" : "text-subtle hover:surface-3",
          )}
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => updateLayer(layer.id, { italic: !layer.italic })}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-app transition",
            layer.italic ? "surface-3 text-[var(--text)]" : "text-subtle hover:surface-3",
          )}
          aria-label="Italic"
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => updateLayer(layer.id, { underline: !layer.underline })}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-app transition",
            layer.underline ? "surface-3 text-[var(--text)]" : "text-subtle hover:surface-3",
          )}
          aria-label="Underline"
        >
          <Underline className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Style ------------------------------ */

function StyleTab({ layer }: { layer: TextLayer }) {
  const updateLayer = useEditor((s) => s.updateLayer);
  const push = React.useCallback(() => useEditor.getState().pushHistory(), []);
  const set = React.useCallback(
    (patch: Partial<TextLayer>) => updateLayer(layer.id, patch, { record: false }),
    [layer.id, updateLayer],
  );

  return (
    <div className="space-y-4">
      <Field label="Font family">
        <FontPicker
          value={layer.fontFamily}
          onChange={(family) => {
            void ensureFont(family, layer.fontWeight, layer.italic);
            updateLayer(layer.id, { fontFamily: family, autoFit: layer.autoFit });
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight">
          <Select
            value={String(layer.fontWeight)}
            onValueChange={(value) => updateLayer(layer.id, { fontWeight: Number(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => (
                <SelectItem key={weight} value={String(weight)}>
                  {weight} · {weightLabel(weight)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Size (px)">
          <Input
            type="number"
            min={4}
            max={800}
            value={Math.round(layer.fontSize)}
            onChange={(event) => set({ fontSize: Number(event.target.value) || 12, autoFit: false })}
            onFocus={push}
            className="h-8 font-mono text-[12px]"
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button
          variant={layer.italic ? "subtle" : "outline"}
          size="sm"
          onClick={() => updateLayer(layer.id, { italic: !layer.italic })}
        >
          <Italic className="size-3.5" /> Italic
        </Button>
        <Button
          variant={layer.underline ? "subtle" : "outline"}
          size="sm"
          onClick={() => updateLayer(layer.id, { underline: !layer.underline })}
        >
          <Underline className="size-3.5" /> Underline
        </Button>
        <Button
          variant={layer.autoFit ? "subtle" : "outline"}
          size="sm"
          onClick={() => updateLayer(layer.id, { autoFit: !layer.autoFit })}
        >
          <Bolt className="size-3.5" /> Auto-fit
        </Button>
      </div>

      <Field label="Colour">
        <ColorField value={layer.color} onChange={(color) => set({ color })} />
      </Field>

      <div onPointerDown={push}>
        <LabeledSlider
          label="Opacity"
          valueLabel={`${Math.round(layer.opacity * 100)}%`}
          min={0.05}
          max={1}
          step={0.01}
          value={[layer.opacity]}
          onValueChange={([value]) => set({ opacity: value })}
        />
        <LabeledSlider
          label="Letter spacing"
          valueLabel={`${(layer.letterSpacing * 100).toFixed(1)}%`}
          min={-0.06}
          max={0.24}
          step={0.002}
          value={[layer.letterSpacing]}
          onValueChange={([value]) => set({ letterSpacing: value })}
          className="mt-3"
        />
        <LabeledSlider
          label="Line height"
          valueLabel={layer.lineHeight.toFixed(2)}
          min={0.8}
          max={2.2}
          step={0.01}
          value={[layer.lineHeight]}
          onValueChange={([value]) => set({ lineHeight: value })}
          className="mt-3"
        />
        <LabeledSlider
          label="Rotation"
          valueLabel={`${layer.rotation.toFixed(1)}°`}
          min={-30}
          max={30}
          step={0.1}
          value={[layer.rotation]}
          onValueChange={([value]) => set({ rotation: value })}
          className="mt-3"
        />
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={() => useEditor.getState().setInspector("effects")}>
        <Sparkles className="size-3.5" /> Realism &amp; print finish →
      </Button>
    </div>
  );
}

function weightLabel(weight: number) {
  const map: Record<number, string> = {
    100: "Thin",
    200: "Extra light",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "Semi bold",
    700: "Bold",
    800: "Extra bold",
    900: "Black",
  };
  return map[weight] ?? "";
}

/* --------------------------- Removal patch ------------------------- */

function PatchTab() {
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const selection = useEditor((s) => s.selection);
  const patchSelected = useEditor((s) => s.updateLayer);
  const push = React.useCallback(() => useEditor.getState().pushHistory(), []);
  const layers = (page?.layers ?? []).filter((layer) => selection.includes(layer.id));

  if (!layers.length) {
    return (
      <EmptyState
        icon={<Wand2 />}
        title="Select a box to remove text"
        description="Every text and cleanup box has its own removal patch: glyph mask, colour fill, texture clone or diffusion inpainting."
      />
    );
  }

  const patch = layers[0].patch;
  const multi = layers.length > 1;
  const set = (partial: Partial<typeof patch>) => {
    for (const layer of layers) {
      patchSelected(layer.id, { patch: partial }, { record: false });
    }
  };

  return (
    <div className="space-y-4">
      {multi ? <Badge variant="brand">{layers.length} boxes selected — changes apply to all</Badge> : null}

      <SwitchField
        label="Remove original text"
        hint="Turn off to keep the source pixels and only overlay new text."
        checked={patch.enabled}
        onCheckedChange={(enabled) => {
          push();
          set({ enabled });
        }}
      />

      <div onPointerDown={push}>
        <Field label="Engine">
          <Select
            value={patch.mode}
            onValueChange={(value) => {
              push();
              set({ mode: value as typeof patch.mode });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (recommended)</SelectItem>
              <SelectItem value="diffusion">Diffusion inpaint</SelectItem>
              <SelectItem value="texture">Texture clone</SelectItem>
              <SelectItem value="color">Colour fill</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="What to erase" className="mt-3">
          <Select
            value={patch.mask}
            onValueChange={(value) => {
              push();
              set({ mask: value as typeof patch.mask });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto — glyphs on flat surfaces</SelectItem>
              <SelectItem value="glyph">Glyphs only</SelectItem>
              <SelectItem value="box">Whole box</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="mt-3 space-y-3">
          <LabeledSlider
            label="Expand mask"
            valueLabel={`${patch.expand} px`}
            min={0}
            max={12}
            step={1}
            value={[patch.expand]}
            onValueChange={([value]) => set({ expand: value })}
            hint="Grow the erased area — fixes grey halos around thin letters."
          />
          <LabeledSlider
            label="Feather edge"
            valueLabel={`${patch.feather} px`}
            min={0}
            max={24}
            step={1}
            value={[patch.feather]}
            onValueChange={([value]) => set({ feather: value })}
          />
          <LabeledSlider
            label="Strength"
            valueLabel={patch.strength.toFixed(2)}
            min={0.1}
            max={1}
            step={0.01}
            value={[patch.strength]}
            onValueChange={([value]) => set({ strength: value })}
            hint="Higher = smoother fill for heavily textured surfaces."
          />
          <LabeledSlider
            label="Texture source offset"
            valueLabel={patch.textureOffset === 0 ? "auto" : `${patch.textureOffset} px`}
            min={-80}
            max={80}
            step={1}
            value={[patch.textureOffset]}
            onValueChange={([value]) => set({ textureOffset: value })}
            hint="0 lets the engine find a clean donor band by itself."
          />
        </div>

        {patch.mode === "color" ? (
          <Field label="Fill colour" className="mt-3">
            <ColorField value={patch.color} onChange={(color) => set({ color })} />
          </Field>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-md)] border border-app surface-2 p-3 text-[11.5px] leading-relaxed text-muted">
        <p className="mb-1 font-medium text-[var(--text)]">Troubleshooting</p>
        <ul className="space-y-1">
          <li>• Faint rectangle left behind → lower Strength, or switch to Texture clone.</li>
          <li>• Grey fringe on letters → Expand +1, Feather −1.</li>
          <li>• Blurry smear → raise Strength and set a texture offset to a genuinely blank area.</li>
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------ Effects ---------------------------- */

function EffectsTab() {
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const selection = useEditor((s) => s.selection);
  const updateLayers = useEditor((s) => s.updateLayers);
  const finishEnabled = useEditor((s) => s.finishEnabled);
  const setFinishEnabled = useEditor((s) => s.setFinishEnabled);
  const finish = useEditor((s) => s.finish);
  const setFinish = useEditor((s) => s.setFinish);
  const push = React.useCallback(() => useEditor.getState().pushHistory(), []);

  const selected = (page?.layers ?? []).filter(
    (layer) => selection.includes(layer.id) && layer.kind === "text",
  ) as TextLayer[];
  const effects: TextEffects = selected[0]?.effects ?? DEFAULT_EFFECTS;

  const setEffects = (partial: Partial<TextEffects>) => {
    if (!selected.length) return;
    updateLayers(
      selected.map((layer) => layer.id),
      { effects: { ...effects, ...partial } },
    );
  };

  return (
    <div className="space-y-5">
      {selected.length ? (
        <div onPointerDown={push} className="space-y-3">
          <SectionTitle action={<Badge variant="brand">{selected.length} box{selected.length > 1 ? "es" : ""}</Badge>}>
            Text realism
          </SectionTitle>
          <LabeledSlider
            label="Ink spread"
            valueLabel={effects.inkSpread.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            value={[effects.inkSpread]}
            onValueChange={([value]) => setEffects({ inkSpread: value })}
            hint="How much the fresh ink bleeds into the paper."
          />
          <LabeledSlider
            label="Edge softness"
            valueLabel={effects.softness.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            value={[effects.softness]}
            onValueChange={([value]) => setEffects({ softness: value })}
          />
          <LabeledSlider
            label="Paper grain"
            valueLabel={effects.grain.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            value={[effects.grain]}
            onValueChange={([value]) => setEffects({ grain: value })}
          />
          <LabeledSlider
            label="JPEG artefacts"
            valueLabel={effects.jpeg.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            value={[effects.jpeg]}
            onValueChange={([value]) => setEffects({ jpeg: value })}
            hint="Real 8×8 DCT ringing, matching a compressed photo."
          />
          <LabeledSlider
            label="Toner jitter"
            valueLabel={effects.opacityJitter.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            value={[effects.opacityJitter]}
            onValueChange={([value]) => setEffects({ opacityJitter: value })}
          />
          <LabeledSlider
            label="Blend edges"
            valueLabel={effects.blendEdges.toFixed(2)}
            min={0}
            max={1}
            step={0.01}
            value={[effects.blendEdges]}
            onValueChange={([value]) => setEffects({ blendEdges: value })}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              updateLayers(
                selected.map((layer) => layer.id),
                { effects: { ...DEFAULT_EFFECTS } },
              )
            }
          >
            <RotateCcw className="size-3.5" /> Reset text effects
          </Button>
        </div>
      ) : (
        <EmptyState
          icon={<Sparkles />}
          title="No text box selected"
          description="Per-box realism controls appear when a text box is selected. The page-wide finish below always applies."
        />
      )}

      <div onPointerDown={push} className="space-y-3 border-t border-app pt-4">
        <SectionTitle
          action={
            <Switch checked={finishEnabled} onCheckedChange={setFinishEnabled} aria-label="Apply page finish" />
          }
        >
          Page finish
        </SectionTitle>
        <p className="text-[11.5px] leading-relaxed text-subtle">
          Applied once to the whole export — this is what makes the edit read as one photo.
        </p>
        <LabeledSlider
          label="Scan quality loss"
          valueLabel={finish.scan.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          value={[finish.scan]}
          onValueChange={([value]) => setFinish({ scan: value })}
        />
        <LabeledSlider
          label="Global grain"
          valueLabel={finish.grain.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          value={[finish.grain]}
          onValueChange={([value]) => setFinish({ grain: value })}
        />
        <LabeledSlider
          label="Global softness"
          valueLabel={finish.softness.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          value={[finish.softness]}
          onValueChange={([value]) => setFinish({ softness: value })}
        />
        <LabeledSlider
          label="Whole-image JPEG"
          valueLabel={finish.jpeg.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          value={[finish.jpeg]}
          onValueChange={([value]) => setFinish({ jpeg: value })}
        />
      </div>
    </div>
  );
}

/* ------------------------------ Layers ----------------------------- */

function LayersTab() {
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const selection = useEditor((s) => s.selection);
  const selectLayers = useEditor((s) => s.selectLayers);
  const toggleLayerFlag = useEditor((s) => s.toggleLayerFlag);
  const reorderLayer = useEditor((s) => s.reorderLayer);
  const removeLayers = useEditor((s) => s.removeLayers);
  const duplicateLayers = useEditor((s) => s.duplicateLayers);
  const renamePage = useEditor((s) => s.renamePage);
  const clearLayers = useEditor((s) => s.clearLayers);
  const layers = page ? [...page.layers].reverse() : [];

  if (!page) return null;

  return (
    <div className="space-y-3">
      <Field label="Page name">
        <Input
          value={page.name}
          onChange={(event) => renamePage(page.id, event.target.value)}
          className="h-8 text-[12.5px]"
        />
      </Field>

      <div className="flex items-center justify-between">
        <SectionTitle>{layers.length} layers</SectionTitle>
        <div className="flex gap-1">
          <Tooltip label="Duplicate selection (⌘D)">
            <Button
              variant="ghost"
              size="iconSm"
              disabled={!selection.length}
              onClick={() => duplicateLayers(selection)}
              aria-label="Duplicate selection"
            >
              <Copy className="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip label="Delete selection (⌫)">
            <Button
              variant="ghost"
              size="iconSm"
              disabled={!selection.length}
              onClick={() => removeLayers(selection)}
              aria-label="Delete selection"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-1">
        {layers.map((layer) => {
          const active = selection.includes(layer.id);
          return (
            <div
              key={layer.id}
              onClick={() => selectLayers([layer.id])}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border px-2 py-1.5 transition",
                active ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/8" : "border-app hover:surface-3",
              )}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerFlag(layer.id, "visible");
                }}
                className="text-subtle transition hover:text-[var(--text)]"
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerFlag(layer.id, "locked");
                }}
                className="text-subtle transition hover:text-[var(--text)]"
                aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
              >
                {layer.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">
                  {layer.kind === "text" ? (layer as TextLayer).text || "Empty text" : "Cleanup patch"}
                </span>
                <span className="block truncate text-[10px] text-subtle">
                  {layer.kind === "text"
                    ? `${(layer as TextLayer).fontFamily} · ${Math.round((layer as TextLayer).fontSize)}px`
                    : `${Math.round(layer.width)}×${Math.round(layer.height)}`}
                </span>
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className="text-subtle opacity-0 transition group-hover:opacity-100"
                    aria-label="Layer actions"
                  >
                    <LayersIcon className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-44 p-1">
                  {(
                    [
                      ["front", "Bring to front"],
                      ["up", "Bring forward"],
                      ["down", "Send backward"],
                      ["back", "Send to back"],
                    ] as const
                  ).map(([direction, label]) => (
                    <button
                      key={direction}
                      type="button"
                      className="flex w-full items-center rounded-[var(--radius-xs)] px-2 py-1.5 text-left text-[12px] transition hover:surface-3"
                      onClick={() => reorderLayer(layer.id, direction)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flex w-full items-center rounded-[var(--radius-xs)] px-2 py-1.5 text-left text-[12px] text-rose-500 transition hover:bg-rose-500/10"
                    onClick={() => removeLayers([layer.id])}
                  >
                    Delete layer
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
      </div>

      {!layers.length ? (
        <EmptyState
          icon={<Sparkles />}
          title="No layers yet"
          description="Run Detect text, or draw a box with the T / B tools."
        />
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={clearLayers}>
          <X className="size-3.5" /> Clear all layers
        </Button>
      )}
    </div>
  );
}

/* ------------------------------ Brush ------------------------------ */

function BrushTab() {
  const brush = useEditor((s) => s.brush);
  const setBrush = useEditor((s) => s.setBrush);
  const setTool = useEditor((s) => s.setTool);
  const setBrushMode = useEditor((s) => s.setBrushMode);
  const tool = useEditor((s) => s.tool);
  const brushMode = useEditor((s) => s.brushMode);
  const brushBatches = useEditor(
    (s) => s.pages.find((item) => item.id === s.activePageId)?.brushBatches ?? [],
  );
  const undoStroke = useEditor((s) => s.undoStroke);
  const clearStrokes = useEditor((s) => s.clearStrokes);
  const strokes = brushBatches.reduce((sum, batch) => sum + batch.strokes.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-app surface-2 px-2.5 py-2">
        <span className="text-[12px] text-muted">
          {tool === "heal" ? "Brush armed" : "Brush is off"}
        </span>
        <Button
          size="sm"
          variant={tool === "heal" ? "subtle" : "gradient"}
          onClick={() => {
            if (tool === "heal") {
              setTool("select");
            } else {
              setTool("heal");
              setBrushMode("on");
            }
          }}
        >
          <Brush className="size-3.5" /> {tool === "heal" ? "Disarm" : "Arm brush"}
        </Button>
      </div>
      {brushMode !== "on" && tool !== "heal" ? (
        <p className="text-[11.5px] leading-relaxed text-subtle">
          Painting needs the brush armed — press <Kbd>H</Kbd> or use the button above.
        </p>
      ) : null}

      <Field label="Brush mode">
        <Select
          value={brush.mode}
          onValueChange={(value) => {
            setBrush({ mode: value as typeof brush.mode });
            setTool("heal");
            setBrushMode("on");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clone">Clone (copy pixels)</SelectItem>
            <SelectItem value="color">Colour fill</SelectItem>
            <SelectItem value="blur">Blur / smudge</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <LabeledSlider
        label="Size"
        valueLabel={`${brush.size} px`}
        min={4}
        max={300}
        step={1}
        value={[brush.size]}
        onValueChange={([value]) => setBrush({ size: value })}
      />
      <LabeledSlider
        label="Hardness"
        valueLabel={brush.hardness.toFixed(2)}
        min={0}
        max={1}
        step={0.01}
        value={[brush.hardness]}
        onValueChange={([value]) => setBrush({ hardness: value })}
      />

      {brush.mode === "color" ? (
        <Field label="Colour">
          <ColorField value={brush.color} onChange={(color) => setBrush({ color })} />
        </Field>
      ) : null}

      {brush.mode === "clone" ? (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-app surface-2 p-2.5">
          <p className="text-[11.5px] leading-relaxed text-muted">
            {brush.source
              ? "Clone source locked. Strokes copy from this point."
              : "Alt-click the canvas to set the clone source."}
          </p>
          <div className="flex gap-2">
            <Badge variant={brush.source ? "accent" : "outline"}>
              {brush.source
                ? `source ${Math.round(brush.source.x)}, ${Math.round(brush.source.y)}`
                : "no source"}
            </Badge>
            {brush.source ? (
              <Button size="sm" variant="ghost" onClick={() => setBrush({ source: null })}>
                Reset
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={undoStroke} disabled={!strokes}>
          Undo stroke
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={clearStrokes} disabled={!strokes}>
          Clear ({strokes})
        </Button>
      </div>

      <div className="rounded-[var(--radius-md)] border border-app surface-2 p-2.5 text-[11.5px] leading-relaxed text-muted">
        <p className="font-medium text-[var(--text)]">Shortcuts</p>
        <p>Alt + click → set clone source</p>
        <p>[ / ] → brush size</p>
        <p>H → toggle the heal brush</p>
      </div>
    </div>
  );
}

/* ------------------------------ Export ----------------------------- */

function ExportTab({ onExport }: { onExport: () => void }) {
  const settings = useEditor((s) => s.exportSettings);
  const setSettings = useEditor((s) => s.setExportSettings);
  const page = useEditor((s) => s.pages.find((item) => item.id === s.activePageId) ?? null);
  const pages = useEditor((s) => s.pages);
  const estimate = page ? estimateOutputSize(page, settings) : null;

  return (
    <div className="space-y-4">
      <Field label="Format">
        <Select
          value={settings.format}
          onValueChange={(value) => setSettings({ format: value as typeof settings.format })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Pages">
        <Select
          value={settings.pageMode}
          onValueChange={(value) => setSettings({ pageMode: value as typeof settings.pageMode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">This page</SelectItem>
            <SelectItem value="all">All pages ({pages.length})</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <LabeledSlider
        label="Scale"
        valueLabel={`${settings.scale.toFixed(2)}×`}
        min={0.25}
        max={3}
        step={0.05}
        value={[settings.scale]}
        onValueChange={([value]) => setSettings({ scale: value })}
        hint={estimate ? `Output: ${estimate.width} × ${estimate.height} px` : undefined}
      />

      {settings.format === "jpeg" || settings.format === "webp" ? (
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

      <Field label="File name">
        <Input
          value={settings.filename}
          onChange={(event) => setSettings({ filename: event.target.value })}
          className="h-8 text-[12.5px]"
        />
      </Field>

      {estimate ? (
        <p className="text-[11.5px] text-subtle">
          Estimated size ≈ {formatBytes(estimate.bytes)} · {estimate.width}×{estimate.height}
        </p>
      ) : null}

      <Button variant="gradient" className="w-full" onClick={onExport} disabled={!page}>
        Export {settings.format.toUpperCase()}
      </Button>
    </div>
  );
}
