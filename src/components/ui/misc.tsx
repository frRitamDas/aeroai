"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-[var(--border)]",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "brand" | "accent" | "outline";
  className?: string;
}) {
  const styles: Record<string, string> = {
    default: "surface-3 text-[var(--text-muted)]",
    brand: "bg-[var(--color-brand-500)]/12 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]",
    accent: "bg-[var(--color-accent-500)]/14 text-[var(--color-accent-600)] dark:text-[var(--color-accent-400)]",
    outline: "border border-app text-[var(--text-muted)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-app surface p-4 shadow-[var(--shadow-panel)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
        {children}
      </h3>
      {action}
    </div>
  );
}

export const ToggleGroup = ToggleGroupPrimitive.Root;

export const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & { label?: string }
>(({ className, children, label, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    title={label}
    aria-label={label}
    className={cn(
      "inline-flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-[var(--radius-xs)] px-2 text-[12px] font-medium text-[var(--text-muted)] transition hover:surface-3 data-[state=on]:surface data-[state=on]:text-[var(--text)] data-[state=on]:shadow-sm [&_svg]:size-3.5",
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));
ToggleGroupItem.displayName = "ToggleGroupItem";

export const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar
      orientation="vertical"
      className="flex w-2 touch-none select-none p-0.5 transition-colors"
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--border-strong)]" />
    </ScrollAreaPrimitive.Scrollbar>
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = "ScrollArea";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full surface-3", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand-500)] to-[var(--color-accent-500)] transition-[width] duration-200"
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

/** Small labelled row used across the inspector. */
export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="block text-[12px] font-medium text-[var(--text-muted)]">{label}</span>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-subtle">{hint}</p> : null}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-app surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-app px-4 py-8 text-center">
      {icon ? <div className="text-subtle [&_svg]:size-6">{icon}</div> : null}
      <p className="text-[13px] font-medium text-[var(--text)]">{title}</p>
      {description ? <p className="max-w-[22rem] text-[12px] text-subtle">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
