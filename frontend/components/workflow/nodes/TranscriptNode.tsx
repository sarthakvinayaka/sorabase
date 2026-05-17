import type { NodeProps } from "@xyflow/react";
import type { TranscriptNodeData } from "@/lib/workflow-types";
import BaseNode from "./BaseNode";

export default function TranscriptNode({ id, data: raw, selected }: NodeProps) {
  const data = raw as unknown as TranscriptNodeData;

  return (
    <BaseNode
      selected={selected}
      accent="bg-blue-400"
      icon="≡"
      typeLabel="Transcript"
      status={data.status}
      nodeId={id}
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight">
        {data.label}
      </p>

      {data.status === "completed" && data.charCount ? (
        <>
          <p className="text-xs text-blue-500 mt-0.5">
            {data.charCount.toLocaleString()} chars
          </p>
          {data.preview && (
            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 leading-snug line-clamp-2 font-mono">
              {data.preview}…
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
          {data.status === "running" ? "Processing…" : "Awaiting input"}
        </p>
      )}
    </BaseNode>
  );
}
