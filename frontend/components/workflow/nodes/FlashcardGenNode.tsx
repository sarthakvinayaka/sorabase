import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { FlashcardGenNodeData } from "@/lib/workflow-types";

export default function FlashcardGenNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as FlashcardGenNodeData;
  const sources = [
    data.includeConcepts && "concepts",
    data.includeDefinitions && "definitions",
    data.includeFormulas && "formulas",
    data.includeQuestions && "questions",
  ].filter(Boolean);
  return (
    <BaseNode selected={selected} accent="bg-aubergine-600" icon="⊞" typeLabel="Flashcard Generator" status={data.status} nodeId={id}>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        Up to {data.maxCards} cards
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5 leading-tight">
        {sources.length ? `From: ${sources.join(", ")}` : "No sources selected"}
      </p>
      {data.flashcardCount !== undefined && (
        <p className="text-2xs text-aubergine-500 mt-0.5">{data.flashcardCount} generated</p>
      )}
    </BaseNode>
  );
}
