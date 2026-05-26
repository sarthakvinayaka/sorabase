import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize    = "sm" | "md" | "lg" | "xl";

// ─── Visual tokens ────────────────────────────────────────────────────────────
// Primary   — aubergine-600 (#5e3848): visible smoked-plum accent, not near-black
// Secondary — warm-neutral bordered, adapts to light/dark
// Ghost     — transparent, text-only, subtle fill on hover
// Destructive — bordered white/dark with red text; fill on hover

const BASE =
  "inline-flex items-center justify-center font-medium rounded-md " +
  "transition-colors select-none whitespace-nowrap shrink-0 " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "gap-1.5 bg-aubergine-600 text-white " +
    "hover:bg-aubergine-700 active:bg-aubergine-800",

  secondary:
    "gap-1.5 border border-stone-200 dark:border-stone-700 " +
    "bg-white dark:bg-stone-900 " +
    "text-stone-700 dark:text-stone-300 " +
    "hover:bg-stone-50 dark:hover:bg-stone-800 " +
    "hover:border-stone-300 dark:hover:border-stone-600 " +
    "hover:text-stone-900 dark:hover:text-stone-100 " +
    "active:bg-stone-100 dark:active:bg-stone-800",

  ghost:
    "gap-1.5 text-stone-600 dark:text-stone-400 " +
    "hover:bg-stone-100 dark:hover:bg-stone-800 " +
    "hover:text-stone-900 dark:hover:text-stone-100 " +
    "active:bg-stone-100 dark:active:bg-stone-800",

  destructive:
    "gap-1.5 border border-stone-200 dark:border-stone-800 " +
    "bg-white dark:bg-stone-900 " +
    "text-red-600 dark:text-red-400 " +
    "hover:bg-red-50 dark:hover:bg-red-950/30 " +
    "hover:border-red-200 dark:hover:border-red-900 " +
    "hover:text-red-700 dark:hover:text-red-300 " +
    "active:bg-red-100 dark:active:bg-red-950/20",
};

// sm  → compact inline/table actions         28 px tall
// md  → standard app buttons (default)       34 px tall
// lg  → prominent app actions                38 px tall
// xl  → marketing CTAs + hero buttons        40 px tall
const SIZES: Record<ButtonSize, string> = {
  sm: "gap-1   px-2.5 py-1   text-xs",
  md: "gap-1.5 px-3.5 py-2   text-sm",
  lg: "gap-1.5 px-4   py-2.5 text-sm",
  xl: "gap-2   px-5   py-2.5 text-[13px]",
};

// ─── buttonVariants ───────────────────────────────────────────────────────────
// Use this for <Link> elements or anywhere the Button component can't be used.
// e.g.  <Link href="…" className={buttonVariants({ variant: "primary", size: "xl" })}>
export function buttonVariants({
  variant  = "primary",
  size     = "md",
  className = "",
}: {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  className?: string;
} = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], className]
    .filter(Boolean)
    .join(" ");
}

// ─── Button component ─────────────────────────────────────────────────────────
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";
