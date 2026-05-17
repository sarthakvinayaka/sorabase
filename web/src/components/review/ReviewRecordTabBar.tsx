"use client";

export type RecordTabId = "structured" | "json" | "summary" | "submittal";

type Props = {
  active: RecordTabId;
  onChange: (tab: RecordTabId) => void;
  canUseApprovedExports: boolean;
};

const TABS: { id: RecordTabId; label: string; needsApproval: boolean }[] = [
  { id: "structured", label: "Structured profile", needsApproval: false },
  { id: "json", label: "JSON (approved)", needsApproval: true },
  { id: "summary", label: "Recruiter summary", needsApproval: true },
  { id: "submittal", label: "Submittal draft", needsApproval: true },
];

export function ReviewRecordTabBar({ active, onChange, canUseApprovedExports }: Props) {
  return (
    <div className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap gap-1 px-4 py-2 sm:px-6">
        {TABS.map((t) => {
          const disabled = t.needsApproval && !canUseApprovedExports;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              title={disabled ? "Approve the record to unlock this tab" : undefined}
              onClick={() => onChange(t.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
