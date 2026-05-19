interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * Canonical in-app page header.
 * eyebrow  — small uppercase label above the title (e.g. "Recruiting mode")
 * title    — h1, always text-2xl font-semibold tracking-tight
 * sub      — optional muted line below the title (string or node)
 * action   — right-aligned slot for buttons / badges
 */
export function PageHeader({ eyebrow, title, sub, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && <p className="section-label mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {title}
        </h1>
        {sub && (
          <div className="mt-1 text-xs text-stone-400 dark:text-stone-500">{sub}</div>
        )}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}
