import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { DefinitionExtractorNodeData } from "@/lib/workflow-types";

export default function DefinitionExtractorNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as DefinitionExtractorNodeData;
  return (
    <BaseNode selected={selected} accent="bg-violet-400" icon="⊟" typeLabel="Definition Extractor" status={data.status} nodeId={id}>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        Up to {data.maxDefinitions} definitions
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        {data.includeContext ? "With surrounding context" : "Definition only"}
      </p>
      {data.definitionCount !== undefined && (
        <p className="text-2xs text-violet-500 mt-0.5">{data.definitionCount} extracted</p>
      )}
    </BaseNode>
  );
}
