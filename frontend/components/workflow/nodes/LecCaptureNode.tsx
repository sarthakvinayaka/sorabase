import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { LecCaptureNodeData } from "@/lib/workflow-types";

const MODE_LABEL: Record<string, string> = {
  paste: "Paste transcript", browser_capture: "Browser capture", zoom_bot: "Zoom bot",
};

export default function LecCaptureNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as LecCaptureNodeData;
  return (
    <BaseNode selected={selected} accent="bg-stone-400" icon="◎" typeLabel="Lecture Capture" status={data.status} nodeId={id} hideTarget>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
        {data.lectureTitle || "Untitled lecture"}
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
        {MODE_LABEL[data.captureMode] ?? data.captureMode}
        {data.charCount ? ` · ${data.charCount.toLocaleString()} chars` : ""}
      </p>
      {data.courseName && (
        <p className="text-2xs text-stone-400 dark:text-stone-500 truncate">{data.courseName}</p>
      )}
    </BaseNode>
  );
}
