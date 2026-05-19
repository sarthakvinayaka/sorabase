import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { ConceptExtractorNodeData } from "@/lib/workflow-types";

export default function ConceptExtractorNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as ConceptExtractorNodeData;
  return (
    <BaseNode selected={selected} accent="bg-violet-500" icon="◈" typeLabel="Concept Extractor" status={data.status} nodeId={id}>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        Up to {data.maxConcepts} concepts
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        {data.confidenceThreshold} confidence
        {data.includeEvidence ? " · with evidence" : ""}
      </p>
      {data.conceptCount !== undefined && (
        <p className="text-2xs text-violet-500 mt-0.5">{data.conceptCount} extracted</p>
      )}
    </BaseNode>
  );
}
