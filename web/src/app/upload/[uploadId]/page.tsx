import { Suspense } from "react";

import { UploadDetailWorkspace } from "@/components/UploadDetailWorkspace";

export default function UploadDetailPage() {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <Suspense fallback={<div className="p-8 text-sm text-zinc-600">Loading…</div>}>
        <UploadDetailWorkspace />
      </Suspense>
    </div>
  );
}
