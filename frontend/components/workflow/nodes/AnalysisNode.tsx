import type { NodeProps } from "@xyflow/react";
import type { AnalysisNodeData } from "@/lib/workflow-types";
import BaseNode from "./BaseNode";

const TIER_COLOR: Record<string, string> = {
  strong_fit:  "text-rose-700",
  good_fit:    "text-blue-500",
  partial_fit: "text-amber-500",
  weak_fit:    "text-orange-500",
  no_fit:      "text-red-500",
};

const TIER_LABEL: Record<string, string> = {
  strong_fit:  "Strong fit",
  good_fit:    "Good fit",
  partial_fit: "Partial fit",
  weak_fit:    "Weak fit",
  no_fit:      "No fit",
};

export default function AnalysisNode({ id, data: raw, selected }: NodeProps) {
  const data = raw as unknown as AnalysisNodeData;

  // Display score as X.X / 10
  const displayScore = (score: number) => (score / 10).toFixed(1);

  // Final effective score: override wins over AI score
  const effectiveTier = data.aiTier;
  const effectiveScore =
    data.scoreStatus === "overridden" && data.finalScore !== undefined
      ? data.finalScore
      : data.aiScore;

  return (
    <BaseNode
      selected={selected}
      accent="bg-amber-500"
      icon="◈"
      typeLabel="AI Scoring"
      status={data.status}
      nodeId={id}
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight truncate">
        {data.jdTitle || "No job description"}
      </p>
      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
        {data.jdText
          ? "JD ready · 4-dimension rubric"
          : "Paste JD in inspector"}
      </p>

      {data.status === "completed" && effectiveScore !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-bold text-stone-800 dark:text-stone-100">
            {displayScore(effectiveScore)}
            <span className="text-[10px] font-normal text-stone-400 dark:text-stone-500">/10</span>
          </span>
          {effectiveTier && (
            <span className={`text-[10px] font-medium ${TIER_COLOR[effectiveTier] ?? "text-stone-400"}`}>
              {TIER_LABEL[effectiveTier] ?? effectiveTier}
            </span>
          )}
          {data.scoreStatus === "overridden" && (
            <span className="text-[9px] font-semibold text-violet-500 bg-violet-50 dark:bg-violet-950/30 rounded px-1">
              override
            </span>
          )}
        </div>
      )}
    </BaseNode>
  );
}
