/**
 * Canonical navigation tab bar — underline style.
 * Used for page-level view switching (e.g. Analytics / Data, Overview / Flashcards).
 *
 * For filter chips (status filters, category pickers) use pill buttons inline —
 * those are a different pattern and intentionally look different.
 */
export interface TabDef<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

interface TabBarProps<T extends string> {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className = "",
}: TabBarProps<T>) {
  return (
    <div className={`flex items-center border-b border-stone-200 dark:border-stone-700 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={[
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
            active === t.id
              ? "border-aubergine-700 text-aubergine-800 dark:text-aubergine-400"
              : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600",
          ].join(" ")}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={[
              "ml-1.5 text-2xs font-semibold tabular-nums",
              active === t.id
                ? "text-aubergine-700 dark:text-aubergine-500"
                : "text-stone-400 dark:text-stone-500",
            ].join(" ")}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
