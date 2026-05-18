/**
 * Shared marketing UI primitives.
 * Import from "@/components/marketing/ui".
 */

import type { HTMLAttributes, ReactNode } from "react";

/* ── Container ───────────────────────────────────────────────────────────── */

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  narrow?: boolean; /* max-w-5xl instead of 7xl */
}

export function Container({ children, narrow, className = "", ...props }: ContainerProps) {
  return (
    <div
      className={[
        "w-full mx-auto px-6 lg:px-10",
        narrow ? "max-w-5xl" : "max-w-7xl",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children:  ReactNode;
  tight?:    boolean; /* py-16 lg:py-20 instead of 24/32 */
  flush?:    boolean; /* no vertical padding — caller controls it */
}

export function Section({ children, tight, flush, className = "", ...props }: SectionProps) {
  const pad = flush ? "" : tight ? "py-16 lg:py-20" : "py-24 lg:py-32";
  return (
    <section className={[pad, className].join(" ")} {...props}>
      {children}
    </section>
  );
}

/* ── Eyebrow ─────────────────────────────────────────────────────────────── */

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={["eyebrow", className].join(" ")}>
      {children}
    </p>
  );
}

/* ── SectionHeading ──────────────────────────────────────────────────────── */

interface HeadingProps {
  children:  ReactNode;
  as?:       "h1" | "h2" | "h3";
  size?:     "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASS = {
  sm: "text-3xl",
  md: "text-4xl",
  lg: "text-5xl",
  xl: "text-6xl",
};

export function SectionHeading({ children, as: Tag = "h2", size = "md", className = "" }: HeadingProps) {
  return (
    <Tag
      className={[
        "heading-section",
        SIZE_CLASS[size],
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}

/* ── Lead paragraph ──────────────────────────────────────────────────────── */

export function Lead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={["text-lead", className].join(" ")}>
      {children}
    </p>
  );
}

/* ── Tag / pill ──────────────────────────────────────────────────────────── */

type TagVariant = "default" | "teal" | "stone";

const TAG_VARIANT: Record<TagVariant, string> = {
  default: "tag-mkt",
  teal:    "inline-flex items-center rounded-full border border-rose-200 dark:border-rose-900 px-2.5 py-0.5 text-[11px] font-medium text-rose-900 dark:text-rose-400",
  stone:   "inline-flex items-center rounded-full border border-stone-200 dark:border-stone-700 px-2.5 py-0.5 text-[11px] font-medium text-stone-500 dark:text-stone-400",
};

export function Tag({
  children,
  variant = "default",
  className = "",
}: {
  children:  ReactNode;
  variant?:  TagVariant;
  className?: string;
}) {
  return (
    <span className={[TAG_VARIANT[variant], className].join(" ")}>
      {children}
    </span>
  );
}

/* ── Divider ─────────────────────────────────────────────────────────────── */

export function Divider({ className = "" }: { className?: string }) {
  return (
    <hr className={["mkt-divider border-0", className].join(" ")} aria-hidden />
  );
}

/* ── Stat (metric display) ───────────────────────────────────────────────── */

export function Stat({
  number,
  label,
  className = "",
}: {
  number:    ReactNode;
  label:     string;
  className?: string;
}) {
  return (
    <div className={["flex flex-col", className].join(" ")}>
      <span className="stat-number">{number}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */

export function MktCard({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={["mkt-card", className].join(" ")} {...props}>
      {children}
    </div>
  );
}
