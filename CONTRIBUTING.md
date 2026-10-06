# Contributing to AeroText Studio

Thanks for helping! This project is a pixel-level editor, so a little discipline
around the engine pays off quickly.

## Setup

```bash
git clone https://github.com/frRitamDas/aeroai.git
cd aeroai
npm install
npm run dev
```

## Before you open a PR

```bash
npm run lint        # ESLint 9 flat config
npm run typecheck   # tsc --noEmit
npm test            # unit tests
npm run verify      # real-pixel pipeline check (writes artifacts/*.png)
```

`npm run verify` regenerates `artifacts/before.png` and `artifacts/after.png`.
Open them if you touched anything under `src/lib/editor`: the change should be
visible in the image, not just green in the test runner.

## Ground rules

1. **Keep `src/lib/editor` framework-free.** No React, no DOM-only APIs at module
   scope. The engine must keep running in plain Node so the verification suite
   can exercise it. Browser-only helpers live in `image.ts` and are guarded.
2. **Every algorithm change comes with a test.** Deterministic helpers take a
   seed; assert on numbers, not screenshots, in `src/**/*.test.ts`.
3. **Never regress the "no ghost" rule.** If you touch masking, dilation,
   feathering or texture transfer, re-run `npm run verify` and confirm the
   `residualInkRatio` stays at 0 and the boundary stays clean.
4. **Add UI state to the Zustand store**, not to component-local state, when it
   must survive an undo, a page switch or a reload.
5. **Accessibility is not optional**: every icon-only button needs an
   `aria-label`, dialogs come from Radix, and colour is never the only signal.

## Commit style

Conventional commits, scoped to the area you touched:

```
feat(editor): add paragraph-level detection grouping
fix(inpaint): stop donor bands from cloning neighbouring glyphs
perf(render): cache healed backdrops per page revision
docs(readme): document self-hosting the OCR assets
```

## Reporting bugs

Please include: browser + OS, the file type you imported, what you expected,
what happened, and — if it is a rendering artefact — a cropped screenshot at
200% zoom. For text-editing artefacts, mention which removal engine the
inspector showed ("Remove → Engine").
