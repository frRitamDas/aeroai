"use client";

import Image from "next/image";
import * as React from "react";
import { MoveHorizontal } from "lucide-react";

/**
 * Interactive before/after wipe used on the landing page. The chalk lettering
 * is real (rendered) content, so the comparison shows exactly what the editor
 * does: remove the old text, keep the surface, type new text on top.
 */
export function BeforeAfter({
  className,
  beforeText = { title: "Cafe Menu", line: "Chicken Banana", meta: "20 minute" },
  afterText = { title: "Cafe Menu", line: "Chicken Noodle", meta: "10 minute" },
}: {
  className?: string;
  beforeText?: { title: string; line: string; meta: string };
  afterText?: { title: string; line: string; meta: string };
}) {
  const [position, setPosition] = React.useState(52);

  const chalk = (offset: number) => ({
    transform: `rotate(-1.1deg) translateY(${offset}px)`,
  });

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-app shadow-[var(--shadow-floating)]">
        <div className="relative aspect-[4/5] w-full select-none">
          <Image
            src="/demo/cafe-board.jpg"
            alt="Café chalkboard used for the before and after text edit demo"
            fill
            priority
            sizes="(max-width: 768px) 92vw, 460px"
            className="object-cover"
          />

          {/* BEFORE layer — chalk text sitting on the board */}
          <div className="absolute inset-0">
            <ChalkText text={beforeText} style={chalk(-2)} />
          </div>

          {/* AFTER layer — clipped by the wipe */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            <div className="absolute inset-0 bg-black/5" />
            <ChalkText text={afterText} style={chalk(2)} />
          </div>

          {/* Wipe handle */}
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
            style={{ left: `${position}%` }}
          >
            <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--text)] shadow-lg">
              <MoveHorizontal className="size-4" />
            </span>
          </div>

          <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            Before
          </span>
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-[var(--color-brand-600)] px-2.5 py-1 text-[11px] font-medium text-white">
            After
          </span>

          <input
            type="range"
            min={2}
            max={98}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-label="Reveal the edited version"
            className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-subtle">
        Drag the handle — the old words are erased, the board texture stays, the new words are typed.
      </p>
    </div>
  );
}

function ChalkText({
  text,
  style,
}: {
  text: { title: string; line: string; meta: string };
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="absolute left-1/2 top-[46%] w-[62%] -translate-x-1/2 -translate-y-1/2 text-center"
      style={{ ...style, fontFamily: "Caveat, cursive" }}
    >
      <p className="text-[clamp(1.4rem,3vw,2.1rem)] font-semibold uppercase tracking-[0.25em] text-[#f4efe4] [text-shadow:0_0_1px_rgba(255,255,255,0.55),0_1px_2px_rgba(0,0,0,0.35)]">
        {text.title}
      </p>
      <div className="mx-auto mt-3 h-px w-full bg-[#f4efe4]/40" />
      <p className="mt-4 text-[clamp(1.6rem,3.4vw,2.5rem)] leading-tight text-[#f7f3ea] [text-shadow:0_0_1px_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.4)]">
        {text.line}
      </p>
      <p className="mt-2 text-[clamp(1.1rem,2.4vw,1.7rem)] text-[#eee9dd]/90 [text-shadow:0_0_1px_rgba(255,255,255,0.4)]">
        {text.meta}
      </p>
    </div>
  );
}
