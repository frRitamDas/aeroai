import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Cpu,
  FileText,
  Gauge,
  Image as ImageIcon,
  Layers,
  Lock,
  MousePointerClick,
  Palette,
  PenTool,
  ScanText,
  ShieldCheck,
  Sparkles,
  Type,
  Wand2,
  Zap,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { Badge, Card, Kbd, SectionTitle } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export function Pill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-app surface-2 px-3 py-1 text-[12px] font-medium text-[var(--text-muted)]">
      <Sparkles className="size-3.5 text-[var(--color-brand-500)]" />
      100% free · No watermark · Nothing uploaded
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.35]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[var(--color-brand-500)]/12 blur-[110px]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-20">
        <div className="animate-rise space-y-6">
          <Pill />
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-[3.4rem]">
            Edit the text inside <span className="bg-gradient-to-r from-[var(--color-brand-500)] to-[var(--color-accent-500)] bg-clip-text text-transparent">images and PDFs</span> — instantly.
          </h1>
          <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-muted sm:text-base">
            AeroText Studio finds every word on your photo, receipt, sign, screenshot or PDF page,
            erases it from the pixels without leaving a smudge, and lets you type the replacement with
            matching font, colour and print texture. No design skills, no upload, no watermark.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" variant="gradient">
              <Link href="/edit">
                Upload image or PDF <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#how">
                <MousePointerClick className="size-4" /> See how it works
              </Link>
            </Button>
          </div>
          <dl className="grid max-w-lg grid-cols-3 gap-4 pt-2">
            {[
              { icon: Lock, title: "On-device", value: "0 bytes uploaded" },
              { icon: Gauge, title: "Speed", value: "~2s per page" },
              { icon: Palette, title: "Fonts", value: "50+ matched" },
            ].map(({ icon: Icon, title, value }) => (
              <div key={title} className="space-y-1">
                <dt className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-wider text-subtle">
                  <Icon className="size-3.5" /> {title}
                </dt>
                <dd className="text-[13.5px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="animate-rise lg:justify-self-end" style={{ animationDelay: "80ms" }}>
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-[var(--radius-xl)] border border-app surface shadow-[var(--shadow-floating)]">
      <div className="flex items-center gap-1.5 border-b border-app px-3 py-2">
        <span className="size-2.5 rounded-full bg-rose-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate text-[11.5px] text-subtle">receipt-2024.pdf · p1 · 2480 × 3508</span>
        <Badge variant="brand" className="ml-auto">
          <Wand2 className="size-3" /> Auto-detected
        </Badge>
      </div>
      <div className="relative aspect-[4/5] w-full surface-2 p-4">
        <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-md)] border border-app bg-white p-5 text-[#101828] shadow-inner">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-[#667085]">
            Northwind Coffee
          </p>
          <div className="mt-4 space-y-2 font-mono text-[12px]">
            {[
              ["Americano", "3.20"],
              ["Flat white", "3.80"],
              ["Almond croissant", "4.10"],
              ["Blueberry muffin", "3.60"],
              ["Total", "14.70"],
            ].map(([label, price], index) => (
              <div key={label} className="flex items-baseline gap-2">
                <span>{label}</span>
                <span className="flex-1 border-b border-dashed border-[#d0d5dd]" />
                <span>{price}</span>
                {index === 2 ? (
                  <span className="absolute right-4 top-[38%] h-[19px] w-[132px] rounded-[3px] border-2 border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10" />
                ) : null}
              </div>
            ))}
          </div>
          <div className="absolute right-3 top-[38%] flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--color-brand-600)] px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Type className="size-3" /> Croissant → Cookie
          </div>
          <div className="absolute bottom-4 left-5 right-5 space-y-1">
            <div className="h-1.5 w-2/3 rounded bg-[#eef0f4]" />
            <div className="h-1.5 w-1/2 rounded bg-[#eef0f4]" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-app text-[11px] text-muted">
        {[
          { icon: ScanText, label: "Detected", value: "12 boxes" },
          { icon: PenTool, label: "Healed", value: "0 smudges" },
          { icon: FileText, label: "Export", value: "PDF · PNG" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col gap-0.5 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-subtle">
              <Icon className="size-3.5" /> {label}
            </span>
            <span className="font-medium text-[var(--text)]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  {
    step: "01",
    icon: ImageIcon,
    title: "Upload",
    body: "Drop a PNG, JPG, WebP or a PDF (every page becomes an editable canvas). Files are read locally with the File API — nothing is ever sent to a server.",
  },
  {
    step: "02",
    icon: ScanText,
    title: "Detect & edit",
    body: "Tesseract OCR finds the words, the analyser measures stroke weight, slant and serifs to match a font, and the healer strips the old glyphs out of the pixels.",
  },
  {
    step: "03",
    icon: FileText,
    title: "Export",
    body: "Bake the realistic finish (grain, ink spread, JPEG ringing) and download a PNG, JPEG, WebP or multi-page PDF at up to 3× the original resolution.",
  },
];

export function Steps() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading
        eyebrow="How it works"
        title="Three steps from upload to finished image"
        description="The workflow stays familiar: open your visual, edit the detected text, export the corrected result."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ step, icon: Icon, title, body }) => (
          <Card key={step} className="relative overflow-hidden">
            <span className="absolute right-4 top-3 font-mono text-[34px] font-semibold text-[var(--border-strong)]">
              {step}
            </span>
            <span className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-500)]/12 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: ScanText,
    title: "AI text detection",
    body: "Line, word and paragraph boxes come straight from OCR with per-box confidence, then every box is re-analysed at pixel level for ink colour and paper colour.",
  },
  {
    icon: EraserIcon,
    title: "Background healing",
    body: "Four removal engines — glyph mask, colour fill, texture clone and diffusion inpainting — pick themselves based on the surface: paper, screen, wood, fabric or a photo.",
  },
  {
    icon: Type,
    title: "Font & style controls",
    body: "Font family, size, weight, italic, underline, colour, opacity, letter spacing, line height and alignment — with automatic font-size fitting inside the box.",
  },
  {
    icon: Palette,
    title: "Realistic print effects",
    body: "Ink spread, edge softness, paper grain, per-glyph toner jitter and a real DCT-based JPEG simulation so a typed word looks photographed, not pasted.",
  },
  {
    icon: Layers,
    title: "Layers, undo, redo",
    body: "Text boxes and cleanup patches are non-destructive layers. Reorder, lock, hide, duplicate, nudge with the keyboard, then undo 60 steps deep.",
  },
  {
    icon: PenTool,
    title: "Manual brush tools",
    body: "Clone, blur and colour brushes for the areas OCR cannot know about — plus manual text boxes and cleanup boxes when detection misses something.",
  },
  {
    icon: FileText,
    title: "Image & PDF input",
    body: "PDF pages are rasterised with pdf.js at up to 2400 px, so page 1..N are all editable — and re-exported as a clean multi-page PDF.",
  },
  {
    icon: Zap,
    title: "Full-size export",
    body: "PNG, JPEG, WebP and PDF up to 3× scale with quality control, a live file-size estimate and clipboard copy for quick sharing.",
  },
  {
    icon: BadgeCheck,
    title: "Project files",
    body: "Save work to IndexedDB, reopen later, and export a portable .json project that keeps every layer, patch and brush stroke intact.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-y border-app surface-2">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything needed for credible text edits"
          description="Built for real work: receipts, invoices, product shots, menus, screenshots, scans and PDF pages."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-[var(--radius-lg)] border border-app surface p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel)]"
            >
              <span className="flex size-9 items-center justify-center rounded-[var(--radius-md)] surface-3 text-[var(--color-brand-600)] transition group-hover:bg-[var(--color-brand-500)] group-hover:text-white dark:text-[var(--color-brand-300)]">
                <Icon className="size-4" />
              </span>
              <h3 className="mt-3.5 text-[14px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EraserIcon(props: React.ComponentProps<typeof Wand2>) {
  return <Wand2 {...props} />;
}

export function Engine() {
  const items = [
    {
      title: "Glyph-mask healing",
      body: "The ink cluster is separated from the paper cluster, the mask is dilated and feathered by 1–3 px, and only the letters are replaced.",
    },
    {
      title: "Diffusion inpainting",
      body: "Multi-pass neighbour propagation fills the erased area, then the high-frequency paper texture is copied back in so no blurry rectangle remains.",
    },
    {
      title: "Donor-band search",
      body: "For textured surfaces the engine scores candidate clone bands by luminance and variance and picks the cleanest one automatically.",
    },
    {
      title: "True JPEG simulation",
      body: "8×8 DCT with the standard quantisation tables and 4:2:0 chroma subsampling reproduces the ringing that makes real photos look compressed.",
    },
  ];

  return (
    <section id="engine" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-4">
          <SectionHeading
            eyebrow="The engine"
            title="Pixel maths, not magic dust"
            description="Every step is a plain, testable function over ImageData. That is why the preview you see is exactly the file you download."
            align="left"
          />
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-500)]/15 text-[var(--color-accent-600)]">
                  <Cpu className="size-3" />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold">{item.title}</p>
                  <p className="text-[12.5px] leading-relaxed text-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-app surface p-4 shadow-[var(--shadow-panel)]">
          <SectionTitle action={<Badge variant="accent">Live in the editor</Badge>}>
            Removal strategies
          </SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { name: "Auto", desc: "Picks the best engine from surface variance", tone: "brand" as const },
              { name: "Glyph mask", desc: "Ink-only erase for clean paper", tone: "accent" as const },
              { name: "Texture clone", desc: "Copies neighbouring surface detail", tone: "default" as const },
              { name: "Diffusion", desc: "Smooth inpaint with grain transfer", tone: "outline" as const },
              { name: "Colour fill", desc: "Studio-flat backgrounds", tone: "default" as const },
              { name: "Brush", desc: "Clone, blur and colour by hand", tone: "outline" as const },
            ].map((item) => (
              <div key={item.name} className="rounded-[var(--radius-md)] border border-app surface-2 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{item.name}</p>
                  <Badge variant={item.tone}>engine</Badge>
                </div>
                <p className="mt-1 text-[12px] text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] surface-3 px-3 py-2.5 text-[12px] text-muted">
            <ShieldCheck className="size-4 text-[var(--color-accent-600)]" />
            Everything runs in a Web Worker / canvas sandbox on your device.
            <span className="ml-auto flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>Z</Kbd> undo
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "How do I match the same font as the original?",
    a: "The analyser measures stroke thickness, slant, serif flare, ink density and x-height from the detected pixels, then ranks the font library against those traits. You get the top four suggestions with reasons, and every other control (weight, italic, spacing, size) is one click away.",
  },
  {
    q: "What happens to the old text?",
    a: "Each box gets a removal patch. Flat paper only has the glyphs replaced; textured surfaces are healed with a diffusion inpaint plus real texture copied back from a clean donor band, so there is no blurry rectangle where the word used to be.",
  },
  {
    q: "Can I edit just one word in a line?",
    a: "Yes. Detection can group by word, line or paragraph. With word grouping every word is its own box, so you can replace a single word and leave the rest of the line untouched. You can also split any box by drawing a smaller manual box over one word.",
  },
  {
    q: "Is my document uploaded anywhere?",
    a: "No. Files are read with the browser File API and processed on your device using WebAssembly (OCR), pdf.js (PDF rasterising) and canvas (healing). There is no upload endpoint in the project — you can run it fully offline.",
  },
  {
    q: "Does it really export PDF?",
    a: "Yes. Import a PDF, every page is rasterised and becomes editable, and the export step writes a multi-page PDF with jsPDF at the resolution you choose (up to 3×).",
  },
  {
    q: "What about small specks left behind?",
    a: "Grow the patch with the Expand slider, raise the strength, or switch the mask to the full box. For stubborn spots, use the colour brush to sample a nearby shade and cover only that area.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-y border-app surface-2">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Answers for common editing moments"
          description="Practical notes on matching source text and keeping edits clean."
        />
        <div className="mt-8 divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-app surface px-5">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium">
                {item.q}
                <span className="text-subtle transition group-open:rotate-45">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-app bg-gradient-to-br from-[var(--color-brand-600)] via-[var(--color-brand-700)] to-[var(--color-brand-950)] px-6 py-12 text-white shadow-[var(--shadow-floating)] sm:px-12">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[var(--color-accent-500)]/30 blur-3xl" />
        <div className="relative max-w-2xl space-y-4">
          <h2 className="text-3xl font-semibold sm:text-4xl">Open the editor — it takes 5 seconds</h2>
          <p className="text-[15px] leading-relaxed text-white/80">
            No account, no credit card, no watermark and no upload. Drop an image or a PDF and start
            editing text straight away.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg" className="bg-white text-[var(--color-brand-700)] hover:bg-white/90">
              <Link href="/edit">
                Start editing <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <a href="https://github.com/frRitamDas/aeroai" target="_blank" rel="noreferrer">
                <GithubIcon className="size-4" /> Star on GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-balance text-2xl font-semibold sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-2.5 text-pretty text-[14px] leading-relaxed text-muted">{description}</p>
      ) : null}
    </div>
  );
}
