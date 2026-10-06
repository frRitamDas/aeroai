"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-1.5", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full surface-3">
      <SliderPrimitive.Range className="absolute h-full bg-[var(--color-brand-500)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block size-3.5 rounded-full border-2 border-[var(--color-brand-500)] surface shadow-sm transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";

export interface LabeledSliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label: string;
  valueLabel?: string;
  hint?: string;
}

export function LabeledSlider({ label, valueLabel, hint, className, ...props }: LabeledSliderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-medium text-[var(--text-muted)]">{label}</span>
        <span className="font-mono text-[11px] text-subtle">{valueLabel}</span>
      </div>
      <Slider {...props} />
      {hint ? <p className="text-[11px] leading-snug text-subtle">{hint}</p> : null}
    </div>
  );
}
