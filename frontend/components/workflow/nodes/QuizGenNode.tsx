import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { QuizGenNodeData } from "@/lib/workflow-types";

const MIX_LABEL: Record<string, string> = {
  easy_heavy: "Easy-heavy", balanced: "Balanced", hard_heavy: "Hard-heavy",
};

export default function QuizGenNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as QuizGenNodeData;
  const types = [
    data.includeMcq && "MCQ",
    data.includeTrueFalse && "T/F",
    data.includeShortAnswer && "Short",
    data.includeMatching && "Match",
    data.includeFillBlank && "Fill",
  ].filter(Boolean);
  return (
    <BaseNode selected={selected} accent="bg-aubergine-600" icon="✦" typeLabel="Quiz Generator" status={data.status} nodeId={id}>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        {MIX_LABEL[data.difficultyMix]} · {data.maxQuestions} questions
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        {types.join(" · ") || "No types selected"}
      </p>
      {data.quizItemCount !== undefined && (
        <p className="text-2xs text-aubergine-500 mt-0.5">{data.quizItemCount} items generated</p>
      )}
    </BaseNode>
  );
}
