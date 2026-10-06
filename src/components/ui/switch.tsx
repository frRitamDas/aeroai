"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--color-brand-500)] data-[state=unchecked]:surface-3 data-[state=unchecked]:border-app",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[2px]" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export function SwitchField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-[12.5px] font-medium text-[var(--text)]">
          {label}
        </label>
        {hint ? <p className="text-[11px] leading-snug text-subtle">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
