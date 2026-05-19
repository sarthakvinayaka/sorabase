import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { QuestionGenNodeData } from "@/lib/workflow-types";

const TEMPLATE_LABEL: Record<string, string> = {
  exam_prep: "Exam prep", lecture_notes: "Lecture notes",
  deep_study: "Deep study", quick_review: "Quick review",
};

export default function QuestionGenNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as QuestionGenNodeData;
  return (
    <BaseNode selected={selected} accent="bg-aubergine-600" icon="?" typeLabel="Questions" status={data.status} nodeId={id}>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        {TEMPLATE_LABEL[data.template] ?? data.template}
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        Up to {data.maxQuestions} questions
      </p>
      {data.questionCount !== undefined && (
        <p className="text-2xs text-aubergine-500 mt-0.5">{data.questionCount} generated</p>
      )}
    </BaseNode>
  );
}
