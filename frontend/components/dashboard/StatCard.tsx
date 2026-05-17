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
        ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800"
        : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700",
    ].join(" ")}>
      <p className="section-label">{label}</p>
      <p className={[
        "text-3xl font-semibold tracking-tight mt-1.5 tabular-nums",
        accent
          ? "text-teal-700 dark:text-teal-300"
          : "text-stone-900 dark:text-stone-100",
      ].join(" ")}>
        {value}
      </p>
      {sub && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{sub}</p>}
    </div>
  );
}
