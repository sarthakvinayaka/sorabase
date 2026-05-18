import type { NodeProps } from "@xyflow/react";
import {
  EXTRACTION_TEMPLATES,
  FIELD_GROUP_DEFS,
  type ExtractionFieldGroup,
  type ExtractionNodeData,
} from "@/lib/workflow-types";
import BaseNode from "./BaseNode";

const THRESHOLD_LABEL: Record<string, string> = {
  high: "High conf.", medium: "Med. conf.", low: "Low conf.",
};

export default function ExtractionNode({ id, data: raw, selected }: NodeProps) {
  const data = raw as unknown as ExtractionNodeData;

  const groups = (data.fieldGroups ?? []) as ExtractionFieldGroup[];
  const activeGroups = groups.filter((g) => g.active);
  const activeFieldCount = activeGroups.reduce((sum, g) => {
    const def = FIELD_GROUP_DEFS.find((d) => d.id === g.id);
    return sum + (def?.fieldCount ?? 0);
  }, 0);

  const templateDef = EXTRACTION_TEMPLATES.find((t) => t.id === data.template);
  const templateLabel = templateDef?.label ?? data.label;

  return (
    <BaseNode
      selected={selected}
      accent="bg-aubergine-700"
      icon="⊞"
      typeLabel="Extraction"
      status={data.status}
      nodeId={id}
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight truncate">
        {templateLabel}
      </p>
      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
        {activeGroups.length} groups · {activeFieldCount} fields
      </p>
      <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-0.5">
        {THRESHOLD_LABEL[data.confidenceThreshold] ?? "Med. conf."}
        {data.flagLowConfidence ? " · flag low" : ""}
      </p>
      {data.status === "completed" && data.extractedCount !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-medium text-aubergine-700">
            {data.extractedCount}/{activeFieldCount} extracted
          </span>
          {data.overallConfidence !== undefined && (
            <span className="text-[10px] text-stone-400 dark:text-stone-500">
              {Math.round(data.overallConfidence * 100)}% conf.
            </span>
          )}
        </div>
      )}
    </BaseNode>
  );
}
