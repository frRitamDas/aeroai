"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";
import { ALL_FONTS, ensureFont, fontMeta, fontStack } from "@/lib/editor/fonts";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Searchable font picker. Google fonts are fetched on demand — the family
 * previews load lazily as the list is filtered so opening the picker is cheap.
 */
export function FontPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (family: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const results = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? ALL_FONTS.filter((font) => font.family.toLowerCase().includes(needle))
      : ALL_FONTS;
    return list.slice(0, 120);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    results.slice(0, 24).forEach((font) => void ensureFont(font.family, 400, false));
  }, [open, results]);

  const meta = fontMeta(value);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-app surface px-2.5 text-left text-[13px] shadow-sm transition hover:border-[var(--border-strong)]"
        style={{ fontFamily: fontStack(value) }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <span className="shrink-0 text-[10px] text-subtle">
          {meta?.class ?? "font"}
        </span>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-[55]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[56] overflow-hidden rounded-[var(--radius-md)] border border-app surface shadow-[var(--shadow-floating)]">
            <div className="relative border-b border-app p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search 50+ fonts…"
                className="h-8 pl-8 text-[12.5px]"
              />
            </div>
            <div ref={listRef} className="scrollbar-thin max-h-64 overflow-y-auto p-1">
              {results.map((font) => (
                <button
                  key={font.family}
                  type="button"
                  onClick={() => {
                    void ensureFont(font.family, 400, false);
                    onChange(font.family);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition hover:surface-3",
                    font.family === value && "surface-3",
                  )}
                >
                  <span
                    className="truncate text-[14px]"
                    style={{ fontFamily: fontStack(font.family) }}
                  >
                    {font.family}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] uppercase text-subtle">
                    {font.class}
                    {font.family === value ? <Check className="size-3 text-[var(--color-brand-500)]" /> : null}
                  </span>
                </button>
              ))}
              {!results.length ? (
                <p className="px-2 py-3 text-center text-[12px] text-subtle">No font matches “{query}”</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
