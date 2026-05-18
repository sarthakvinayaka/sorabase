interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: Props) {
  return (
    <div className={[
      "rounded-lg border px-5 py-4 transition-colors",
      accent
        ? "bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-200 dark:border-aubergine-900"
        : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700",
    ].join(" ")}>
      <p className="section-label">{label}</p>
      <p className={[
        "text-3xl font-semibold tracking-tight mt-1.5 tabular-nums",
        accent
          ? "text-aubergine-900 dark:text-aubergine-300"
          : "text-stone-900 dark:text-stone-100",
      ].join(" ")}>
        {value}
      </p>
      {sub && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{sub}</p>}
    </div>
  );
}
