import type { TranscriptDetailDTO } from "./reviewTypes";

function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  transcript: TranscriptDetailDTO | null;
};

export function TranscriptPanel({ transcript }: Props) {
  if (!transcript) {
    return (
      <aside className="flex flex-col border-b border-zinc-200 bg-white lg:min-h-[calc(100vh-5rem)] lg:border-b-0 lg:border-r">
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Transcript</h2>
          <p className="mt-1 text-sm text-zinc-600">No transcript linked for this candidate.</p>
        </header>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col border-b border-zinc-200 bg-white lg:min-h-[calc(100vh-5rem)] lg:border-b-0 lg:border-r">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Transcript</h2>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          v{transcript.version} · {transcript.provider ?? "—"} · {transcript.language ?? "—"}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <ol className="space-y-5">
          {transcript.segments.map((seg) => (
            <li key={seg.id} className="border-l-2 border-zinc-200 pl-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-zinc-500">
                <span className="font-semibold tracking-tight text-zinc-900">{seg.speaker_label ?? "Speaker"}</span>
                <time className="font-mono tabular-nums text-zinc-500">
                  {formatClock(seg.start_ms)}–{formatClock(seg.end_ms)}
                </time>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-800">{seg.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
