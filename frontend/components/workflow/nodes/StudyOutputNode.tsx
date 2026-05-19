import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { StudyOutputNodeData } from "@/lib/workflow-types";

export default function StudyOutputNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as StudyOutputNodeData;
  const exports = [
    data.exportJson && "JSON",
    data.exportCsv  && "CSV",
    data.exportAnki && "Anki",
  ].filter(Boolean);
  return (
    <BaseNode selected={selected} accent="bg-emerald-500" icon="↑" typeLabel="Study Pack Output" status={data.status} nodeId={id} hideSource>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        {data.packTitle || "Study pack"}
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        {data.autoArchive ? "Auto-archive" : "Manual archive"}
        {exports.length ? ` · ${exports.join(", ")}` : ""}
      </p>
      {data.lectureId && (
        <p className="text-2xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono truncate">
          {data.lectureId.slice(0, 12)}…
        </p>
      )}
    </BaseNode>
  );
}
