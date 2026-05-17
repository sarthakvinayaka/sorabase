import { Suspense } from "react";

import { RecruitingAnalyticsDashboard } from "@/components/analytics/RecruitingAnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-stone-500">Loading…</div>}>
      <RecruitingAnalyticsDashboard />
    </Suspense>
  );
}
