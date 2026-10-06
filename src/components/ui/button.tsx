"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium transition-[color,background-color,box-shadow,border-color,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-[0.5px] [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-brand-600)] text-white shadow-sm hover:bg-[var(--color-brand-500)]",
        gradient:
          "bg-gradient-to-br from-[var(--color-brand-500)] via-[var(--color-brand-600)] to-[var(--color-accent-600)] text-white shadow-[var(--shadow-glow)] hover:brightness-110",
        outline:
          "border border-app surface text-[var(--text)] hover:surface-3 hover:border-[var(--border-strong)]",
        ghost: "text-[var(--text-muted)] hover:surface-3 hover:text-[var(--text)]",
        subtle: "surface-3 text-[var(--text)] hover:brightness-[0.97] dark:hover:brightness-110",
        danger: "bg-rose-600 text-white hover:bg-rose-500",
        link: "text-[var(--color-brand-600)] underline-offset-4 hover:underline dark:text-[var(--color-brand-300)]",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-3.5",
        default: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-9 [&_svg]:size-4",
        iconSm: "size-7 rounded-[var(--radius-sm)] [&_svg]:size-3.5",
        iconLg: "size-11 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
