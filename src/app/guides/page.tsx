import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, PenTool, ScanText, Type } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge, Card, Kbd, SectionTitle } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Guides — editing text in photos, receipts and PDFs",
  description:
    "Step-by-step guides for replacing text in receipts, editing PDF pages, matching the original font and blending edits so they look untouched.",
  alternates: { canonical: "/guides" },
};

const GUIDES = [
  {
    id: "receipts",
    icon: FileText,
    title: "Edit a receipt or invoice",
    intro:
      "Receipts are the hardest surface: thermal paper, uneven lighting, folds and JPEG noise. Here is the reliable order of operations.",
    steps: [
      "Import the photo or PDF. Every PDF page is rasterised at page resolution, so nothing is downscaled before editing.",
      "Run Detect with word grouping. Word-level boxes let you change a single price or date without touching the rest of the line.",
      "Zoom to 200–400% and check one box. If the mask preview leaves grey halos, raise Expand by 1–2 px and pull Feather down to 1.",
      "Set removal to Auto. Flat thermal paper resolves to colour-fill plus glyph mask; photographed paper resolves to diffusion.",
      "Type the replacement and enable Auto-fit. The engine sizes the text so the block height matches the original line exactly.",
      "Enable the realistic finish (grain 0.1–0.2, JPEG 0.4) before exporting, otherwise the new word looks suspiciously clean.",
    ],
    tip: "Export PNG for archive quality, JPEG at 92% when the destination is an app that re-compresses anyway.",
  },
  {
    id: "pdf",
    icon: ScanText,
    title: "Edit a page in a PDF",
    intro:
      "PDF pages arrive as vector + image mixes. AeroText rasterises them so the healing engines can work on real pixels.",
    steps: [
      "Drop the PDF in. Pages are rendered at up to 2400 px on the long edge — raise it in the import dialog for dense scans.",
      "Use the page rail to move between pages; each page keeps its own layers and brush work.",
      "Detect changes on the current page only, so you can fine-tune per page.",
      "For scanned PDFs turn on Deskew-friendly settings: line grouping plus diffusion removal handles the paper texture best.",
      "Export as PDF for a multi-page document, or PNG for a single corrected page.",
    ],
    tip: "The PDF is rebuilt page by page — a 12-page edit exports in one file, in order, with your layer work baked in.",
  },
  {
    id: "fonts",
    icon: Type,
    title: "Match the original font convincingly",
    intro:
      "The trait analyser gets you close automatically. These controls take it the last 10%.",
    steps: [
      "Open the Style tab — the four ranked suggestions show why each font was picked (serif flare, stroke weight, width, slant).",
      "If the new text is too thick, step the weight down one notch before shrinking the size; weight changes stroke, size changes everything.",
      "Letter spacing is the fastest way to match a wide or condensed original: 0.02–0.06 em fixes most mismatches.",
      "A 0.5–1.5° rotation is common on photographed text — match it so the baseline sits on the original baseline.",
      "Turn on Ink spread (0.1–0.3) for printed originals and Opacity jitter for laser-toner or thermal output.",
    ],
    tip: "Compare with the Original toggle on the left of the toolbar to flick between your edit and the source.",
  },
  {
    id: "blend",
    icon: PenTool,
    title: "Blend an edit so nobody notices",
    intro:
      "Three sliders do most of the work — and one secret is that the finish must match the whole image, not just the box.",
    steps: [
      "Start with the patch: if a faint grey rectangle appears where the old word was, the removal is too aggressive. Lower Strength and raise Texture offset to a genuine clean band.",
      "Add grain at the individual layer level first (0.1), then a global finish grain of the same value so the page reads as one photo.",
      "Simulated JPEG at 0.3–0.5 restores the ringing around the glyph edges that the camera created everywhere else.",
      "Softness above 0.2 is almost always wrong — it destroys the glyph shape. Keep it under 0.1 unless the whole photo is out of focus.",
      "Use the blur brush (small, hard) to knock back any leftover specks from the original glyphs.",
    ],
    tip: "Export at the original resolution or higher. Upscaling hides small imperfect edges and is what most print shops expect anyway.",
  },
];

export default function GuidesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/">
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </Button>
        <header className="space-y-3">
          <Badge variant="brand">Guides</Badge>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Editing text in images and PDFs, done properly
          </h1>
          <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted">
            Short, practical walkthroughs for the situations that come up in real work. Each guide maps
            directly to controls inside the editor.
          </p>
        </header>

        <nav className="mt-8 flex flex-wrap gap-2">
          {GUIDES.map((guide) => (
            <a
              key={guide.id}
              href={`#${guide.id}`}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-app surface px-3 py-1.5 text-[12.5px] font-medium text-muted transition hover:surface-3 hover:text-[var(--text)]"
            >
              <guide.icon className="size-3.5" />
              {guide.title}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-6">
          {GUIDES.map((guide) => (
            <Card key={guide.id} id={guide.id} className="scroll-mt-24 p-5 sm:p-6">
              <SectionTitle
                action={<Badge variant="outline">{guide.steps.length} steps</Badge>}
              >
                Guide
              </SectionTitle>
              <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold">
                <guide.icon className="size-5 text-[var(--color-brand-500)]" />
                {guide.title}
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{guide.intro}</p>
              <ol className="mt-4 space-y-2.5">
                {guide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-[13px] leading-relaxed">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full surface-3 font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                      {index + 1}
                    </span>
                    <span className="text-muted">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-accent-500)]/10 px-3 py-2 text-[12.5px] text-[var(--text-muted)]">
                <strong className="font-semibold text-[var(--text)]">Tip · </strong>
                {guide.tip}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-10 rounded-[var(--radius-xl)] border border-app surface p-6">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { keys: ["V"], action: "Select / move" },
              { keys: ["T"], action: "New text box" },
              { keys: ["B"], action: "Cleanup box" },
              { keys: ["H"], action: "Heal brush" },
              { keys: ["I"], action: "Colour picker" },
              { keys: ["Space"], action: "Pan canvas" },
              { keys: ["⌘", "Z"], action: "Undo" },
              { keys: ["⌘", "⇧", "Z"], action: "Redo" },
              { keys: ["⌘", "D"], action: "Duplicate selection" },
              { keys: ["⌘", "E"], action: "Open export" },
              { keys: ["⌘", "O"], action: "Open files" },
              { keys: ["Delete"], action: "Remove selection" },
            ].map((item) => (
              <div key={item.action} className="flex items-center justify-between gap-3 border-b border-app py-1.5 last:border-b-0">
                <span className="text-[12.5px] text-muted">{item.action}</span>
                <span className="flex gap-1">
                  {item.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-xl)] border border-app surface-2 p-6">
          <div>
            <h2 className="text-lg font-semibold">Ready to try it?</h2>
            <p className="text-[13px] text-muted">
              Open the editor with your own image or PDF — nothing is uploaded.
            </p>
          </div>
          <Button asChild variant="gradient" size="lg">
            <Link href="/edit">
              Open editor <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
