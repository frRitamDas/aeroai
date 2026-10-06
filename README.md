# AeroText Studio

**An open-source PDF & image text editor — edit the words inside a photo, scan, receipt or PDF page and export a result nobody can tell was edited.**

AeroText Studio detects the text on your visual, erases the original glyphs *out of the pixels* (not a white box on top), matches the typography with pixel-level trait analysis, and re-prints your replacement with the grain, ink spread and JPEG artefacts of the original photo. Everything runs in the browser — **no upload, no account, no watermark.**

> Think "PhoText, but self-hosted, MIT licensed and fully inspectable".

---

## Table of contents

- [Feature tour](#feature-tour)
- [The engine](#the-engine)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Testing & verification](#testing--verification)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Privacy & offline use](#privacy--offline-use)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Feature tour

| Area | What you get |
| --- | --- |
| **Input** | PNG · JPEG · WebP · BMP · GIF · AVIF · PDF (every page rasterised and editable) · `.json` project files |
| **Detection** | On-device OCR (Tesseract.js) with **word / line / paragraph** grouping, per-box confidence, automatic language download for 20+ languages |
| **Removal** | Four self-selecting engines: glyph mask, gradient-aware colour fill, texture clone, diffusion inpainting — plus manual clone / blur / colour brushes |
| **Typography** | Font trait analysis (stroke weight, slant, serif flare, ink density) → ranked font suggestions from 50+ Google & system families, auto-fit sizing, spacing, line height, alignment, rotation |
| **Realism** | Ink spread, edge softness, paper grain, per-glyph toner jitter, true DCT-based JPEG simulation, page-wide scan-quality finish |
| **Editing UX** | Non-destructive layers, 60-step undo/redo, drag/resize/rotate with the keyboard, marquee selection, zoom to 800%, dark mode, autosave, mobile layout |
| **Export** | PNG · JPEG · WebP · multi-page PDF at 0.25×–3× scale with live size estimation and clipboard copy |

---

## The engine

Everything in `src/lib/editor` is a pure, testable function over `ImageData`.

### 1 · Detection and analysis

```
OCR (Tesseract.js worker, cached per language)
  └─ lines/words → normalised boxes
       └─ per box: analyseTextRegion()
            ├─ ink vs paper colours      (deterministic 2-means clustering)
            ├─ ink ratio                 (ink footprint inside the box)
            ├─ stroke ratio              (median horizontal + vertical run length / text height)
            ├─ slant                     (top vs bottom ink-centroid shear, in degrees)
            ├─ serif score               (baseline-band flare rows)
            └─ x-height ratio
                 └─ suggestFonts() → ranked family / weight / italic + a reason
```

### 2 · Removal (`inpaint.ts`)

| Engine | How it works | Best for |
| --- | --- | --- |
| **Glyph mask** | Threshold between the ink and paper clusters, dilated by the feather radius (dilation first, *then* a blur — this is what stops ghost letters appearing) | Clean paper, scans |
| **Colour fill** | Flat fill in the ink colour plus a **coarse local drift field** measured from the surrounding pixels, applied as a relative offset | Slightly sloped or unevenly lit paper |
| **Texture clone** | Inpaint for the low frequencies + clamped, DC-corrected high-frequency residuals copied from a scored donor band | Fabric, wood, noisy photos |
| **Diffusion inpaint** | Iterative neighbour propagation with a multi-scale warm start, then texture transfer | Heavy texture, logos, big blocks |
| **Brush** | Clone / blur / colour strokes for anything OCR cannot know about | Leftover specks |

Auto mode picks a strategy from the surface statistics: *flat paper + dense ink → colour fill; flat paper → texture clone; textured surface → diffusion.*

### 3 · Rendering and finish (`render.ts`, `effects.ts`)

```
renderBase()   original pixels + every removal patch applied (cached per page)
  → brush batches           clone / blur / colour strokes
    → text layers           each painted on its own transparent bitmap:
                            font load → wrap → auto-fit → per-glyph alpha jitter
                            → ink spread → edge feather → softness → grain → JPEG
      → composePage()       rotate + place with alpha
        → page finish       scan-quality tone loss, global grain, global JPEG
          → export          PNG / JPEG / WebP / multi-page PDF (jsPDF)
```

The JPEG simulation is a real 8×8 DCT with the standard quantisation tables and 4:2:0 chroma subsampling, at full resolution *and* per text layer — that is why a replaced word keeps the ringing of the photo around it.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack) + **React 19** | Static marketing pages, one client-side editor route, zero server endpoints |
| Language | **TypeScript 5.9** (`strict`) | The engine is numeric; types keep the geometry honest |
| Styling | **Tailwind CSS v4** + CSS custom-property theming | Dark mode without a theme flash |
| Components | **Radix UI** primitives + **CVA** + `tailwind-merge` | Accessible dialogs, selects, sliders, tooltips |
| State | **Zustand** (+ `persist`) | Structural sharing, undo/redo stacks, no context storms |
| OCR | **Tesseract.js 7** (WASM, web worker) | On-device recognition, lazy per language |
| PDF | **pdf.js 6** (local worker) in, **jsPDF 4** out | Rasterise in, rebuild out |
| Icons | **Lucide** | Consistent 1.5px stroke set |
| Tests | **Vitest** + jsdom, **Playwright** (optional), `@napi-rs/canvas` for the real-pixel verification run | 70+ unit tests over the engine + an image-visible pipeline check |
| Lint/format | **ESLint 9** (flat config, `eslint-config-next`) | CI enforced |

No backend, no database, no upload endpoint — the app is a static export waiting to happen.

---

## Getting started

```bash
git clone https://github.com/frRitamDas/aeroai.git
cd aeroai
npm install          # also copies the pdf.js worker into /public
npm run dev          # http://localhost:3000
```

Requirements: **Node ≥ 20.9** (developed on 22) and a Chromium/Firefox/Safari with WebAssembly + `OffscreenCanvas` support.

Open **`/edit`**, drop an image or a PDF, and the editor detects the text for you.

> First OCR run downloads the Tesseract engine and the language model from the public CDN (≈10 MB for English). Everything afterwards — healing, rendering, export — is fully local. See [Privacy & offline use](#privacy--offline-use) to self-host those assets.

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx            root layout, metadata, theme bootstrap
│   ├── page.tsx              landing page (hero, before/after, features, FAQ)
│   ├── guides/page.tsx       long-form how-to guides + shortcut reference
│   ├── edit/page.tsx         the editor route
│   └── globals.css           design tokens, dark mode, utilities
├── components/
│   ├── editor/
│   │   ├── editor-shell.tsx  composition root: import, shortcuts, autosave
│   │   ├── canvas-stage.tsx  viewport, hit-testing, transforms, brush input
│   │   ├── text-box-editor.tsx  in-place typography-matching editor
│   │   ├── inspector.tsx     content / style / remove / finish / layers tabs
│   │   ├── toolbar.tsx       tool rail, top bar, status bar
│   │   ├── page-rail.tsx     multi-page thumbnails
│   │   ├── export-dialog.tsx format, scale, quality, clipboard
│   │   └── font-picker.tsx   searchable, lazily loaded font list
│   ├── marketing/            landing-page sections
│   └── ui/                   buttons, inputs, sliders, overlays, tabs
├── lib/
│   ├── editor/
│   │   ├── types.ts          the document / layer model
│   │   ├── store.ts          Zustand store, undo/redo, detection pipeline
│   │   ├── detect.ts         OCR lines → ready-to-edit text layers
│   │   ├── ocr.ts            Tesseract worker lifecycle + result normalisation
│   │   ├── analyze/color.ts  clustering, region statistics, font traits input
│   │   ├── fonts.ts          font catalogue, lazy Google Fonts, suggestions
│   │   ├── inpaint.ts        the four removal engines + mask tools
│   │   ├── effects.ts        blur, grain, ink spread, DCT JPEG, scan quality
│   │   ├── render.ts         page compositor (preview and export share it)
│   │   ├── geometry.ts       hit-testing, rotated resize/rotate maths
│   │   ├── documents.ts      image + PDF import
│   │   ├── export.ts         PNG/JPEG/WebP/PDF writers
│   │   └── project.ts        IndexedDB autosave + portable .json projects
│   └── utils.ts
verify/engine.test.ts         real-pixel pipeline verification (writes artifacts/)
e2e/editor.spec.ts            Playwright browser smoke tests
scripts/setup-assets.mjs      copies the pdf.js worker into /public
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (engine maths, geometry, OCR parsing, storage) |
| `npm run verify` | Full local pipeline on a synthetic photo → writes `artifacts/before.png` + `after.png` |
| `npm run e2e` | Playwright browser tests (needs `npx playwright install chromium`) |

---

## Testing & verification

Three layers, because pixel work needs more than assertions:

1. **Unit tests** (`npm test`) — clustering, region statistics, glyph masks, donor search, every heal engine, DCT/JPEG behaviour, mask dilation/feathering, rotated resize anchoring, OCR result normalisation from four different Tesseract shapes, font scoring, geometry.
2. **Engine verification** (`npm run verify`) — renders a synthetic *photographed receipt* with `@napi-rs/canvas`, runs the real analyse → heal → finish pipeline, and asserts there is no residual ink while writing before/after PNGs you can look at. This is what caught (and fixed) donor bands cloning neighbouring letters and anti-aliased glyph fringes surviving as ghosts.
3. **Browser tests** (`npm run e2e`) — import an image, draw a text box, type a replacement, export a PNG, drag a project file in.

---

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `V` / `T` / `B` / `H` / `I` | Select · Text box · Cleanup box · Heal brush · Colour picker |
| `Space` + drag, or middle-drag | Pan the canvas |
| `⌘/Ctrl` + scroll | Zoom around the pointer |
| `[` / `]` | Brush size |
| `Alt` + click | Set the clone source |
| Double-click a box | Edit its text in place |
| `⌘/Ctrl + Z` / `⇧⌘Z` | Undo / Redo |
| `⌘/Ctrl + D` / `⌘/Ctrl + A` | Duplicate / select all layers |
| `⌘/Ctrl + S` / `⌘/Ctrl + O` / `⌘/Ctrl + E` | Save project · Open files · Export |
| Arrows (`⇧` = ×10) | Nudge the selection 1 px / 10 px |
| `Delete` | Remove the selection |

---

## Privacy & offline use

- Files are read through the **File API** and never leave the tab. There is no upload endpoint anywhere in this repository.
- OCR, PDF rasterising, healing, rendering and export all run in the browser (WASM workers + canvas).
- Projects autosave to **IndexedDB**; `.json` project files export and import losslessly (layers, patches and brush strokes included).
- **Fully offline**: the pdf.js worker is served from `/public`. To remove the two remaining CDN reads (Tesseract core + language data), self-host them:

```ts
// in src/lib/editor/ocr.ts
createWorker(language, 1, {
  workerPath: "/vendor/tesseract/worker.min.js",
  corePath: "/vendor/tesseract-core",
  langPath: "/vendor/tessdata", // gzipped .traineddata files
  logger,
});
```

---

## Deployment

The app builds to static routes plus the editor bundle — deploy anywhere that runs Next.js:

```bash
npm run build && npm start
```

- **Vercel**: import the repo; no environment variables needed.
- **Docker / Node host**: `npm ci --omit=dev && npm run build && npm start`.
- **Air-gapped**: pre-download `pdf.worker.min.mjs` (already in `/public`) plus the Tesseract core/lang data and swap in the self-hosted paths above.

---

## Roadmap

- [ ] Auto **font embedding / glyph matching** from the original raster (stroke-width matching instead of family suggestions)
- [ ] True **vector PDF text editing** for PDFs with an embedded text layer (no rasterising)
- [ ] **Batch mode** — apply the same replacement across a folder of scans
- [ ] **Translation** pass: detect → translate → re-render in the source typography
- [ ] Desktop packaging (Tauri) for drag-and-drop from the OS shell

---

## Contributing

Pull requests are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). The short version:

```bash
npm install
npm run lint && npm run typecheck && npm test && npm run verify
```

Please keep `src/lib/editor` free of React imports: it is the engine, and it must stay testable in plain Node.

---

## License

[MIT](./LICENSE) © Ritam Das and contributors.

AeroText Studio is an independent project and is not affiliated with photext.com or any other hosted editor. Fonts loaded at runtime remain under their own licences (Google Fonts / system fonts).
