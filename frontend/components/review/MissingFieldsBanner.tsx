import { FIELD_LABELS } from "@/lib/types";

interface Props {
  missingFields: string[];
  ambiguousFields: string[];
}

export default function MissingFieldsBanner({ missingFields, ambiguousFields }: Props) {
  if (missingFields.length === 0 && ambiguousFields.length === 0) return null;

  return (
    <div className="rounded-lg border border-warning-border bg-warning-light px-5 py-4 space-y-2.5">
      {missingFields.length > 0 && (
        <div>
          <p className="text-2xs font-semibold tracking-label uppercase text-warning-text mb-1">
            Missing · {missingFields.length}
          </p>
          <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
            {missingFields.map((f) => FIELD_LABELS[f] ?? f).join(" · ")}
          </p>
        </div>
      )}
      {ambiguousFields.length > 0 && (
        <div>
          <p className="text-2xs font-semibold tracking-label uppercase text-warning-text mb-1">
            Ambiguous · {ambiguousFields.length}
          </p>
          <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
            {ambiguousFields.map((f) => FIELD_LABELS[f] ?? f).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
