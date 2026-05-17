import { humanizeFieldName } from "@/lib/humanizeFieldName";

import type { ReviewFieldDTO } from "./reviewTypes";

function useMultiline(field: ReviewFieldDTO, value: string): boolean {
  if (value.length > 120) return true;
  const multi = [
    "primary_skills",
    "secondary_skills",
    "previous_companies",
    "education",
    "certifications",
    "target_roles",
    "client_fit_summary",
    "recruiter_recommendation",
    "concerns_or_red_flags",
    "domain_experience",
    "industries_worked_in",
  ];
  return multi.includes(field.field_name);
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence == null) {
    return <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">n/a</span>;
  }
  const c = Math.round(confidence * 100);
  const tone = c >= 85 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : c >= 60 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-rose-200 bg-rose-50 text-rose-950";
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums ${tone}`} title="Model confidence">
      {c}%
    </span>
  );
}

function norm(s: string): string {
  return s.trim();
}

function sourceBadge(source: string): { label: string; className: string } {
  if (source === "model" || source === "heuristic") {
    return { label: "AI", className: "border-violet-200 bg-violet-50 text-violet-950" };
  }
  if (source === "human_edit" || source === "manual") {
    return { label: "Human-edited", className: "border-sky-200 bg-sky-50 text-sky-950" };
  }
  return { label: source, className: "border-zinc-200 bg-zinc-50 text-zinc-700" };
}

function formatEditedAt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return null;
  }
}

type Props = {
  field: ReviewFieldDTO;
  value: string;
  dirty: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
};

export function EditableFieldRow({ field, value, dirty, disabled, onChange }: Props) {
  const ml = useMultiline(field, value);
  const editedAwayFromAi =
    field.ai_extracted_value != null && norm(field.ai_extracted_value ?? "") !== norm(value);
  const borderL = field.is_ambiguous_from_model
    ? "border-l-rose-400"
    : field.is_missing_from_model
      ? "border-l-amber-400"
      : editedAwayFromAi
        ? "border-l-sky-500"
        : field.needs_attention
          ? "border-l-zinc-400"
          : "border-l-transparent";

  const src = sourceBadge(field.source);
  const editedLabel = formatEditedAt(field.edited_at);

  return (
    <div className={`rounded-lg border border-zinc-200 bg-white ${borderL} border-l-4 pl-3 pr-3 py-3 shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-zinc-900" htmlFor={`f-${field.id}`}>
              {humanizeFieldName(field.field_name)}
            </label>
            <ConfidenceBadge confidence={field.confidence} />
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${src.className}`}
              title="How this value was last established"
            >
              {src.label}
            </span>
            {field.is_missing_from_model ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                Missing
              </span>
            ) : null}
            {field.is_ambiguous_from_model ? (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-950">
                Ambiguous
              </span>
            ) : null}
            {dirty ? (
              <span className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">Unsaved</span>
            ) : null}
            {editedAwayFromAi ? (
              <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-900">Differs from AI</span>
            ) : null}
            {editedLabel ? (
              <span className="text-[10px] text-zinc-500" title="Last persisted edit">
                Last edited {editedLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2">
        {ml ? (
          <textarea
            id={`f-${field.id}`}
            disabled={disabled}
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full resize-y rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-sm leading-relaxed text-zinc-900 outline-none ring-zinc-900 focus:ring-1 disabled:bg-zinc-50 disabled:text-zinc-500"
            aria-label={humanizeFieldName(field.field_name)}
          />
        ) : (
          <input
            id={`f-${field.id}`}
            type="text"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none ring-zinc-900 focus:ring-1 disabled:bg-zinc-50 disabled:text-zinc-500"
            aria-label={humanizeFieldName(field.field_name)}
          />
        )}
      </div>
      {field.ai_extracted_value != null && editedAwayFromAi ? (
        <div className="mt-2 rounded border border-dashed border-sky-200 bg-sky-50/60 px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Original (AI snapshot)</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-sky-950">{field.ai_extracted_value}</p>
        </div>
      ) : null}
      {field.evidence_snippets.length > 0 ? (
        <div className="mt-2 rounded border border-dashed border-zinc-200 bg-zinc-50/80 px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Evidence</p>
          {field.evidence_snippets.map((ev) => (
            <blockquote key={ev.id} className="mt-1 border-l-2 border-zinc-300 pl-2 text-xs leading-relaxed text-zinc-700">
              {ev.evidence_text}
            </blockquote>
          ))}
        </div>
      ) : null}
    </div>
  );
}
