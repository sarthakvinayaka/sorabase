import { type NodeProps } from "@xyflow/react";
import BaseNode from "./BaseNode";
import type { TranscriptCleanerNodeData } from "@/lib/workflow-types";

const PRESET_LABEL: Record<string, string> = {
  lecture: "Lecture preset", seminar: "Seminar preset", verbatim: "Verbatim (no clean)",
};

export default function TranscriptCleanerNode({ id, selected, data: raw }: NodeProps) {
  const data = raw as unknown as TranscriptCleanerNodeData;
  const options = [
    data.removeFiller && "filler removed",
    data.fixSpeakerLabels && "speakers fixed",
    data.collapseRepetitions && "repetitions collapsed",
  ].filter(Boolean);
  return (
    <BaseNode selected={selected} accent="bg-sky-400" icon="≋" typeLabel="Transcript Cleaner" status={data.status} nodeId={id}>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
        {PRESET_LABEL[data.preset] ?? data.preset}
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5 leading-tight">
        {options.length ? options.join(" · ") : "No cleaning options set"}
      </p>
      {data.charCount && (
        <p className="text-2xs text-sky-500 mt-0.5">{data.charCount.toLocaleString()} chars out</p>
      )}
    </BaseNode>
  );
}
