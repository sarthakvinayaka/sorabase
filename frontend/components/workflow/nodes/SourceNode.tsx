import type { NodeProps } from "@xyflow/react";
import type { SourceNodeData } from "@/lib/workflow-types";
import BaseNode from "./BaseNode";

const INPUT_LABEL: Record<string, string> = {
  transcript_paste: "Paste transcript",
  audio_upload:     "Audio upload",
  zoom_bot:         "Zoom bot",
  zoom:             "Zoom recording",
};

const BOT_DOT: Record<string, string> = {
  joining:               "bg-amber-400 animate-pulse",
  waiting_for_admission: "bg-amber-400 animate-pulse",
  in_meeting:            "bg-blue-400",
  recording:             "bg-blue-500 animate-pulse",
  transcribing:          "bg-aubergine-400 animate-pulse",
  ready:                 "bg-aubergine-700",
  extracting:            "bg-aubergine-400 animate-pulse",
  complete:              "bg-aubergine-700",
  failed:                "bg-red-400",
};

const BOT_LABEL: Record<string, string> = {
  joining:               "Joining…",
  waiting_for_admission: "Waiting for admission",
  in_meeting:            "In meeting",
  recording:             "Recording",
  transcribing:          "Transcribing…",
  ready:                 "Transcript ready",
  extracting:            "Extracting…",
  complete:              "Complete",
  failed:                "Failed",
};

export default function SourceNode({ id, data: raw, selected }: NodeProps) {
  const data = raw as unknown as SourceNodeData;
  const hasTranscript = !!data.transcript?.trim();

  return (
    <BaseNode
      selected={selected}
      accent="bg-stone-400"
      icon="◎"
      typeLabel="Source"
      status={data.status}
      hideTarget
      nodeId={id}
    >
      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight">
        {data.label}
      </p>
      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
        {INPUT_LABEL[data.inputMode] ?? data.inputMode}
      </p>

      {/* Transcript paste */}
      {data.inputMode === "transcript_paste" && (
        <>
          {data.jobReference && (
            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 font-mono truncate">
              ref: {data.jobReference}
            </p>
          )}
          {hasTranscript && (
            <p className="text-[10px] text-aubergine-700 mt-1.5">
              {data.transcript.length.toLocaleString()} chars
            </p>
          )}
        </>
      )}

      {/* Zoom bot — live status */}
      {data.inputMode === "zoom_bot" && (
        <>
          {data.botSessionId ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${BOT_DOT[data.botStatus ?? ""] ?? "bg-stone-300"}`} />
              <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                {BOT_LABEL[data.botStatus ?? ""] ?? data.botStatus}
                {data.botTranscriptChars ? ` · ${data.botTranscriptChars.toLocaleString()} ch` : ""}
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-1.5">
              {data.botMeetingUrl ? "Bot not yet sent" : "No meeting URL"}
            </p>
          )}
          {data.botStatus === "failed" && (
            <p className="text-[10px] text-red-400 mt-0.5 truncate">
              {data.botErrorMessage ?? "Error"}
            </p>
          )}
        </>
      )}

      {/* Zoom cloud recording */}
      {data.inputMode === "zoom" && (
        <>
          {data.zoomConversationId ? (
            <p className="text-[10px] text-blue-500 mt-1.5 truncate">
              {data.zoomMeetingId ? `Meeting ${data.zoomMeetingId}` : "Recording selected"}
              {data.zoomCharCount ? ` · ${data.zoomCharCount.toLocaleString()} ch` : ""}
            </p>
          ) : (
            <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-1.5">
              No recording selected
            </p>
          )}
        </>
      )}
    </BaseNode>
  );
}
