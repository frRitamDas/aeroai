"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[var(--radius-sm)] border border-app surface px-2.5 py-1 text-sm text-[var(--text)] shadow-sm transition placeholder:text-subtle focus:border-[var(--color-brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex w-full rounded-[var(--radius-sm)] border border-app surface px-2.5 py-2 text-sm leading-relaxed text-[var(--text)] shadow-sm transition placeholder:text-subtle focus:border-[var(--color-brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-2 text-[12px] font-medium text-[var(--text-muted)]",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function ColorField({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  const [text, setText] = React.useState(value);
  const [synced, setSynced] = React.useState(value);
  // Keep the text field in sync when the colour changes elsewhere (e.g. the
  // eyedropper or a font-match suggestion) without an effect round-trip.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative inline-flex size-8 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-app shadow-sm">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-[-6px] size-[calc(100%+12px)] cursor-pointer border-0 bg-transparent p-0"
          aria-label={label ?? "Choose colour"}
        />
      </span>
      <Input
        value={text}
        spellCheck={false}
        onChange={(event) => {
          setText(event.target.value);
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(event.target.value.trim())) {
            onChange(event.target.value.trim());
          }
        }}
        onBlur={() => setText(value)}
        className="h-8 font-mono text-[12px] uppercase"
      />
    </div>
  );
}
