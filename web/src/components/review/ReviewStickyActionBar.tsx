type Props = {
  dirty: boolean;
  saveDisabled: boolean;
  actionDisabled: boolean;
  approveDisabled: boolean;
  rejectDisabled: boolean;
  onSave: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRerunExtraction: () => void;
};

export function ReviewStickyActionBar({
  dirty,
  saveDisabled,
  actionDisabled,
  approveDisabled,
  rejectDisabled,
  onSave,
  onApprove,
  onReject,
  onRerunExtraction,
}: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        <span className="mr-auto hidden text-xs text-zinc-500 sm:inline">
          {dirty ? "Unsaved changes" : "All changes saved"}
          <span className="ml-2 font-mono text-[10px] text-zinc-400">Ctrl+S to save</span>
        </span>
        <button
          type="button"
          disabled={saveDisabled}
          onClick={onSave}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          disabled={actionDisabled}
          onClick={onRerunExtraction}
          className="rounded-md border border-dashed border-zinc-400 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Re-run extraction
        </button>
        <button
          type="button"
          disabled={actionDisabled || rejectDisabled}
          onClick={onReject}
          className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={actionDisabled || approveDisabled}
          onClick={onApprove}
          className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Approve
        </button>
      </div>
    </div>
  );
}
