import { useMemo } from "react";

import { GROUP_LABELS, GROUP_ORDER, isReviewFieldGroup } from "@/lib/staffingReviewGroups";

import { EditableFieldRow } from "./EditableFieldRow";
import { FieldSection } from "./FieldSection";
import type { ReviewFieldDTO } from "./reviewTypes";

type Props = {
  fields: ReviewFieldDTO[];
  needsReviewOnly: boolean;
  onNeedsReviewOnlyChange: (v: boolean) => void;
  localValues: Record<string, string>;
  baseline: Record<string, string>;
  disabled: boolean;
  onChange: (fieldId: string, value: string) => void;
};

export function StructuredFieldsPanel({
  fields,
  needsReviewOnly,
  onNeedsReviewOnlyChange,
  localValues,
  baseline,
  disabled,
  onChange,
}: Props) {
  const grouped = useMemo(() => {
    const map: Record<string, ReviewFieldDTO[]> = {};
    for (const g of GROUP_ORDER) map[g] = [];
    for (const f of fields) {
      const g = isReviewFieldGroup(f.group) ? f.group : "profile";
      map[g].push(f);
    }
    return map;
  }, [fields]);

  const visible = (list: ReviewFieldDTO[]) => {
    if (!needsReviewOnly) return list;
    return list.filter((f) => f.needs_attention);
  };

  return (
    <div className="flex flex-col bg-zinc-50/50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Structured extraction</h2>
            <p className="mt-1 text-sm text-zinc-600">Edit values inline. Saves are explicit — nothing leaves this page until you save.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              checked={needsReviewOnly}
              onChange={(e) => onNeedsReviewOnlyChange(e.target.checked)}
            />
            <span className="select-none">Needs review only</span>
          </label>
        </div>
      </header>
      <div className="flex-1 space-y-10 overflow-y-auto px-5 py-6 lg:max-h-[calc(100vh-5rem)]">
        {needsReviewOnly && fields.length > 0 && !fields.some((f) => f.needs_attention) ? (
          <p className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
            No fields match “needs review only”. Clear the filter to see all fields.
          </p>
        ) : null}
        {GROUP_ORDER.map((group) => {
          const list = visible(grouped[group] ?? []);
          if (list.length === 0) return null;
          return (
            <FieldSection key={group} title={GROUP_LABELS[group]} description={`${list.length} field${list.length === 1 ? "" : "s"}`}>
              {list.map((f) => {
                const v = localValues[f.id] ?? "";
                const dirty = v !== (baseline[f.id] ?? "");
                return <EditableFieldRow key={f.id} field={f} value={v} dirty={dirty} disabled={disabled} onChange={(nv) => onChange(f.id, nv)} />;
              })}
            </FieldSection>
          );
        })}
      </div>
    </div>
  );
}
