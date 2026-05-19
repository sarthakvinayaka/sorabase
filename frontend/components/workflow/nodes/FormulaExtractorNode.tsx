import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { FormulaExtractorNodeData } from "@/lib/workflow-types";

export default function FormulaExtractorNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as FormulaExtractorNodeData;
  const opts = [
    data.includeUnits && "units",
    data.includeDerivations && "derivations",
  ].filter(Boolean);
  return (
    <BaseNode selected={selected} accent="bg-violet-500" icon="∑" typeLabel="Formula Extractor" status={data.status} nodeId={id}>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        Formulas + notation
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        {opts.length ? `Includes ${opts.join(", ")}` : "Basic extraction"}
      </p>
      {data.formulaCount !== undefined && (
        <p className="text-2xs text-violet-500 mt-0.5">{data.formulaCount} extracted</p>
      )}
    </BaseNode>
  );
}
