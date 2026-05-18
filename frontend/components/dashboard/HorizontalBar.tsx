import type { CountItem } from "@/lib/types";

interface Props {
  items: CountItem[];
  colorClass?: string;
}

export function HorizontalBar({ items, colorClass = "bg-rose-700" }: Props) {
  if (items.length === 0) {
    return <p className="text-xs text-stone-400 dark:text-stone-500 py-2">No data yet.</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs text-stone-500 dark:text-stone-400 text-right truncate leading-none">
            {item.label}
          </span>
          <div className="flex-1 h-[5px] bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${colorClass} opacity-80 transition-all duration-300`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-5 shrink-0 text-xs text-stone-500 dark:text-stone-400 tabular-nums text-right">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
