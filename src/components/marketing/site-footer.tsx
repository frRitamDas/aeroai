import Link from "next/link";
import { GithubIcon } from "@/components/icons";
import { Heart, Sparkles } from "lucide-react";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/edit", label: "Open editor" },
      { href: "/#features", label: "Features" },
      { href: "/#engine", label: "Engine" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Guides",
    links: [
      { href: "/guides#receipts", label: "Edit a receipt" },
      { href: "/guides#pdf", label: "Edit a PDF page" },
      { href: "/guides#fonts", label: "Match a font" },
      { href: "/guides#blend", label: "Blend an edit" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "https://github.com/frRitamDas/aeroai", label: "GitHub repository" },
      { href: "https://github.com/frRitamDas/aeroai/issues", label: "Report an issue" },
      { href: "https://nextjs.org", label: "Built with Next.js" },
      { href: "https://github.com/naptha/tesseract.js", label: "Powered by Tesseract.js" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-app surface-2">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_2fr]">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-accent-500)] text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="text-[15px] font-semibold">AeroText Studio</span>
          </Link>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-muted">
            An open-source, privacy-first image and PDF text editor. Detect, erase, replace and style
            text without uploading a single byte.
          </p>
          <p className="flex items-center gap-1.5 text-[12px] text-subtle">
            Made with <Heart className="size-3.5 text-rose-500" /> using Next.js, Tesseract.js and pdf.js
          </p>
          <a
            href="https://github.com/frRitamDas/aeroai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-app surface px-3 py-1.5 text-[12.5px] font-medium transition hover:surface-3"
          >
            <GithubIcon className="size-3.5" /> frRitamDas/aeroai
          </a>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("http") ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12.5px] text-muted transition hover:text-[var(--text)]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[12.5px] text-muted transition hover:text-[var(--text)]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-app">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-[11.5px] text-subtle sm:px-6">
          <p>© {new Date().getFullYear()} AeroText Studio. MIT licensed.</p>
          <p>
            Your files never leave your device. Free forever, no watermark, no sign-up.
          </p>
        </div>
      </div>
    </footer>
  );
}
