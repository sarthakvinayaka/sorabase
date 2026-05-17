import { Suspense } from "react";

import { ReviewConsole } from "@/components/review/ReviewConsole";

export default function CandidateReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-100 p-8 text-sm text-zinc-600">Loading review…</div>}>
      <ReviewConsole />
    </Suspense>
  );
}
