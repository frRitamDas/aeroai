"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ----------------------------- Tooltip ----------------------------- */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={350}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({
  label,
  children,
  side = "top",
  shortcut,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[60] flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--text)] px-2 py-1 text-[11.5px] font-medium text-[var(--surface)] shadow-[var(--shadow-floating)] animate-fade"
        >
          {label}
          {shortcut ? (
            <kbd className="rounded bg-white/15 px-1 font-mono text-[10px] text-white/90">{shortcut}</kbd>
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ------------------------------ Dialog ----------------------------- */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[70] animate-fade bg-[var(--overlay)] backdrop-blur-[2px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[71] w-[min(94vw,44rem)] max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--radius-lg)] border border-app surface shadow-[var(--shadow-floating)] animate-fade",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-[var(--radius-sm)] p-1.5 text-subtle transition hover:surface-3 hover:text-[var(--text)]">
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  title,
  description,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="space-y-1 border-b border-app px-5 py-4">
      <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-[12.5px] text-muted">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}

/* ----------------------------- Popover ----------------------------- */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[65] w-64 rounded-[var(--radius-md)] border border-app surface p-3 text-[var(--text)] shadow-[var(--shadow-floating)] animate-fade",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";

/* -------------------------- Dropdown menu -------------------------- */

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[65] min-w-52 overflow-hidden rounded-[var(--radius-md)] border border-app surface p-1 text-[var(--text)] shadow-[var(--shadow-floating)] animate-fade",
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { danger?: boolean }
>(({ className, danger, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer items-center gap-2 rounded-[var(--radius-xs)] px-2.5 py-1.5 text-[12.5px] outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:surface-3 [&_svg]:size-3.5 [&_svg]:text-subtle",
      danger && "text-rose-500 data-[highlighted]:bg-rose-500/10 [&_svg]:text-rose-500",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownPrimitive.Label className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-subtle">
      {children}
    </DropdownPrimitive.Label>
  );
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-[var(--border)]" />;
}

/* ---------------------------- Accordion ---------------------------- */

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  value,
  title,
  children,
  defaultOpen,
}: {
  value: string;
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <AccordionPrimitive.Item
      value={value}
      className="border-b border-app last:border-b-0"
      {...(defaultOpen ? {} : {})}
    >
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-3 py-3 text-left text-[13px] font-medium text-[var(--text)] transition hover:text-[var(--color-brand-600)]">
          {title}
          <ChevronDown className="size-4 shrink-0 text-subtle transition group-data-[state=open]:rotate-180" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden">
        <div className="pb-3 text-[13px] leading-relaxed text-muted">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
