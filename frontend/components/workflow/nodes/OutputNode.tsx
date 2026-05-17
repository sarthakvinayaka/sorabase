import type { NodeProps } from "@xyflow/react";
import type { OutputNodeData, ExtraOutputFormat } from "@/lib/workflow-types";
import BaseNode from "./BaseNode";

const FORMAT_LABEL: Record<ExtraOutputFormat, string> = {
  json: "JSON",
  csv:  "CSV",
  api:  "API",
};

export default function OutputNode({ id, data: raw, selected }: NodeProps) {
  const data = raw as unknown as OutputNodeData;
  const extras = (data.extraFormats ?? []) as ExtraOutputFormat[];

  return (
    <BaseNode
      selected={selected}
      accent="bg-emerald-500"
      icon="↑"
      typeLabel="Output"
      status={data.status}
      hideSource
      nodeId={id}
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight">
        {data.label}
      </p>
      {/* Dashboard is always-on — shown as a fixed indicator */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[10px] font-semibold text-emerald-500">Dashboard</span>
        <span className="text-[10px] text-stone-300 dark:text-stone-600">· always on</span>
      </div>
      {/* Optional extra formats */}
      {extras.length > 0 ? (
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
          + {extras.map((f) => FORMAT_LABEL[f]).join(", ")}
        </p>
      ) : (
        <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-0.5">No extras</p>
      )}
      {data.status === "completed" && data.candidateId && (
        <p className="text-[10px] text-emerald-500 mt-1.5">Output ready</p>
      )}
    </BaseNode>
  );
}
