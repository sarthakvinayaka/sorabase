import type { NodeProps } from "@xyflow/react";
import type { SchemaNodeData } from "@/lib/workflow-types";
import BaseNode from "./BaseNode";

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  empty:    { label: "Not configured",  cls: "text-stone-400 dark:text-stone-500" },
  proposed: { label: "Pending review",  cls: "text-amber-600 dark:text-amber-400" },
  approved: { label: "Approved",        cls: "text-teal-600 dark:text-teal-400"   },
};

export default function SchemaNode({ id, data: raw, selected }: NodeProps) {
  const data = raw as unknown as SchemaNodeData;
  const chip = STATUS_CHIP[data.schemaStatus] ?? STATUS_CHIP.empty;

  return (
    <BaseNode
      selected={selected}
      accent="bg-violet-500"
      icon="⊟"
      typeLabel="Schema"
      status={data.status}
      nodeId={id}
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight">
        {data.label}
      </p>

      <p className={`text-xs mt-0.5 ${chip.cls}`}>
        {chip.label}
      </p>

      {data.columns.length > 0 && (
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
          {data.columns.length} column{data.columns.length !== 1 ? "s" : ""}
          {data.templateId ? " · from template" : ""}
        </p>
      )}

      {data.schemaStatus === "proposed" && (
        <p className="text-[10px] text-amber-500 mt-1 font-medium">
          Click to review →
        </p>
      )}
    </BaseNode>
  );
}
