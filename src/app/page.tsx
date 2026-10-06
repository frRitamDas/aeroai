import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BeforeAfter } from "@/components/marketing/before-after";
import {
  CallToAction,
  Engine,
  Faq,
  Features,
  Hero,
  Steps,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "PDF Editor | Image text editor | AeroText Studio",
  description:
    "Edit text in images and PDFs instantly with AI. Modify, erase and replace text in photos, receipts, menus and PDF pages without design skills. Free, no watermark, runs in your browser.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-10 rounded-[var(--radius-2xl)] border border-app surface p-6 shadow-[var(--shadow-panel)] sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
                AI text layer
              </p>
              <h2 className="text-2xl font-semibold sm:text-3xl">
                One word changed. The photo stays a photo.
              </h2>
              <p className="text-[14px] leading-relaxed text-muted">
                AeroText Studio does not paint a white box over your text. It separates the ink from
                the surface, rebuilds the background with real texture from a nearby clean band, and
                puts the new word back with the same chalk, ink or toner character — including the
                compression artefacts the camera already baked in.
              </p>
              <ul className="space-y-2 pt-1 text-[13px] text-muted">
                {[
                  "Original glyphs detected and masked at pixel level",
                  "Background rebuilt from a scored donor band",
                  "Replacement painted, grain-matched and JPEG-simulated",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-accent-500)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <BeforeAfter />
          </div>
        </section>

        <Steps />
        <Features />
        <Engine />
        <Faq />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
