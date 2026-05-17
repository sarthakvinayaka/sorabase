import type { NodeProps } from "@xyflow/react";
import type { SummaryNodeData } from "@/lib/workflow-types";
import BaseNode from "./BaseNode";

export default function SummaryNode({ id, data: raw, selected }: NodeProps) {
  const data = raw as unknown as SummaryNodeData;

  return (
    <BaseNode
      selected={selected}
      accent="bg-amber-400"
      icon="◈"
      typeLabel="Summary"
      status={data.status}
      nodeId={id}
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight">
        {data.label}
      </p>

      {data.status === "completed" && data.text ? (
        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 leading-snug line-clamp-3">
          {data.text}
        </p>
      ) : (
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
          {data.status === "running" ? "Generating…" : "Populated after extraction"}
        </p>
      )}
    </BaseNode>
  );
}
