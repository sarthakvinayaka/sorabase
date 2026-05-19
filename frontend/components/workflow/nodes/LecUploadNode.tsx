import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { LecUploadNodeData } from "@/lib/workflow-types";

const FORMAT_LABEL: Record<string, string> = {
  audio: "Audio file", pdf: "PDF / Slides", markdown: "Markdown",
};

export default function LecUploadNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as LecUploadNodeData;
  return (
    <BaseNode selected={selected} accent="bg-stone-500" icon="⇡" typeLabel="Lecture Upload" status={data.status} nodeId={id} hideTarget>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
        {data.lectureTitle || "Untitled lecture"}
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        {FORMAT_LABEL[data.format] ?? data.format}
        {data.fileName ? ` · ${data.fileName}` : ""}
      </p>
      {data.courseName && (
        <p className="text-2xs text-stone-400 dark:text-stone-500 truncate">{data.courseName}</p>
      )}
    </BaseNode>
  );
}
