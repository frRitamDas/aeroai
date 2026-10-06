"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Sparkles, X } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#engine", label: "Engine" },
  { href: "/#faq", label: "FAQ" },
  { href: "/guides", label: "Guides" },
];

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-app glass">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-accent-500)] text-white shadow-sm">
            <Sparkles className="size-4" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">AeroText Studio</span>
            <span className="text-[10.5px] text-subtle">Image &amp; PDF text editor</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium text-[var(--text-muted)] transition hover:surface-3 hover:text-[var(--text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <a
            href="https://github.com/frRitamDas/aeroai"
            target="_blank"
            rel="noreferrer"
            className="hidden size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition hover:surface-3 hover:text-[var(--text)] sm:inline-flex"
            aria-label="Source code on GitHub"
          >
            <GithubIcon className="size-4" />
          </a>
          <Button asChild variant="gradient" size="sm" className="hidden sm:inline-flex">
            <Link href="/edit">Open editor</Link>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition hover:surface-3 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-app px-4 pb-4 pt-2 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="flex flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:surface-3"
            >
              {item.label}
            </Link>
          ))}
          <Button asChild variant="gradient" className="mt-2">
            <Link href="/edit">Open the editor</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
