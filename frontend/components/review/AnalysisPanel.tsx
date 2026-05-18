"use client";

import { useEffect, useState } from "react";
import {
  getAnalysis,
  listAnalyses,
  listJobs,
  triggerAnalysis,
} from "@/lib/api";
import type { AnalysisRun, AnalysisTier, Job, RequirementAssessment } from "@/lib/types";
import { SubmittalDraftPanel } from "@/components/review/SubmittalDraftPanel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<AnalysisTier, string> = {
  strong_fit: "bg-aubergine-100 text-aubergine-900 border-aubergine-200",
  good_fit: "bg-green-100 text-green-800 border-green-200",
  partial_fit: "bg-yellow-100 text-yellow-800 border-yellow-200",
  weak_fit: "bg-orange-100 text-orange-800 border-orange-200",
  no_fit: "bg-red-100 text-red-800 border-red-200",
};

const TIER_LABELS: Record<AnalysisTier, string> = {
  strong_fit: "Strong Fit",
  good_fit: "Good Fit",
  partial_fit: "Partial Fit",
  weak_fit: "Weak Fit",
  no_fit: "No Fit",
};

const DIMENSION_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  domain: "Domain",
  logistics: "Logistics",
};

const DIMENSION_WEIGHTS: Record<string, string> = {
  skills: "35%",
  experience: "20%",
  domain: "15%",
  logistics: "30%",
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-aubergine-700"
      : score >= 70
      ? "bg-aubergine-700"
      : score >= 50
      ? "bg-yellow-500"
      : score >= 30
      ? "bg-orange-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{score}</span>
    </div>
  );
}

function RequirementList({
  items,
  met,
}: {
  items: RequirementAssessment[];
  met: boolean;
}) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((r, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="mt-0.5 flex-shrink-0">
            {met ? (
              <span className="text-aubergine-800">✓</span>
            ) : (
              <span className="text-red-500">✗</span>
            )}
          </span>
          <div>
            <span className="font-medium">{r.requirement}</span>
            {r.candidate_evidence && (
              <p className="text-stone-500 mt-0.5 italic">"{r.candidate_evidence}"</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return <p className="text-sm text-stone-400">None noted.</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className={`text-sm flex gap-2 ${color}`}>
          <span>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// AnalysisView — renders a completed analysis
// ---------------------------------------------------------------------------

function AnalysisView({ run }: { run: AnalysisRun }) {
  const tier = run.overall_tier as AnalysisTier | null;

  return (
    <div className="space-y-6">
      {/* Overall score */}
      <div className="flex items-center gap-4">
        <div className="text-5xl font-bold text-stone-800">{run.overall_score}</div>
        <div>
          {tier && (
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${TIER_STYLES[tier]}`}
            >
              {TIER_LABELS[tier]}
            </span>
          )}
          <p className="text-xs text-stone-400 mt-1">
            {run.model_used} · {run.prompt_tokens}+{run.completion_tokens} tokens
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      {run.score_breakdown && (
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Score Breakdown
          </h4>
          <div className="space-y-3">
            {Object.entries(run.score_breakdown).map(([dim, ds]) => (
              <div key={dim}>
                <div className="flex justify-between text-xs text-stone-500 mb-1">
                  <span>
                    {DIMENSION_LABELS[dim] ?? dim}{" "}
                    <span className="text-stone-400">({DIMENSION_WEIGHTS[dim]})</span>
                  </span>
                </div>
                <ScoreBar score={ds.score} />
                <p className="text-xs text-stone-500 mt-1">{ds.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      {run.rationale && (
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Rationale
          </h4>
          <p className="text-sm text-stone-700 leading-relaxed">{run.rationale}</p>
        </div>
      )}

      {/* Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Hard Requirements Met ({run.hard_requirements_met?.length ?? 0})
          </h4>
          <RequirementList items={run.hard_requirements_met ?? []} met={true} />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
            Hard Requirements Missed ({run.hard_requirements_missed?.length ?? 0})
          </h4>
          <RequirementList items={run.hard_requirements_missed ?? []} met={false} />
        </div>
      </div>

      {(run.preferred_requirements_met?.length || run.preferred_requirements_missed?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              Preferred Met ({run.preferred_requirements_met?.length ?? 0})
            </h4>
            <RequirementList items={run.preferred_requirements_met ?? []} met={true} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
              Preferred Missed ({run.preferred_requirements_missed?.length ?? 0})
            </h4>
            <RequirementList items={run.preferred_requirements_missed ?? []} met={false} />
          </div>
        </div>
      ) : null}

      {/* Strengths / Gaps / Concerns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-aubergine-800 uppercase tracking-wider mb-2">
            Strengths
          </h4>
          <BulletList items={run.strengths ?? []} color="text-aubergine-900" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
            Gaps
          </h4>
          <BulletList items={run.gaps ?? []} color="text-amber-700" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
            Concerns
          </h4>
          <BulletList items={run.concerns ?? []} color="text-red-700" />
        </div>
      </div>

      {/* Missing info */}
      {run.missing_info && run.missing_info.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Missing Information
          </h4>
          <BulletList items={run.missing_info} color="text-stone-600" />
        </div>
      )}

      {/* Follow-up questions */}
      {run.suggested_follow_up_questions && run.suggested_follow_up_questions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Suggested Follow-Up Questions
          </h4>
          <ol className="space-y-1 list-decimal list-inside">
            {run.suggested_follow_up_questions.map((q, i) => (
              <li key={i} className="text-sm text-stone-700">
                {q}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnalysisPanel — top-level exported component
// ---------------------------------------------------------------------------

export function AnalysisPanel({ candidateId }: { candidateId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [analyses, setAnalyses] = useState<AnalysisRun[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisRun | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listJobs().then(setJobs).catch(() => {});
    listAnalyses(candidateId).then((runs) => {
      setAnalyses(runs);
      if (runs.length > 0) setActiveAnalysis(runs[0]);
    }).catch(() => {});
  }, [candidateId]);

  async function handleTrigger() {
    if (!selectedJobId) return;
    setTriggering(true);
    setError(null);
    try {
      const run = await triggerAnalysis(candidateId, selectedJobId);
      setAnalyses((prev) => [run, ...prev]);
      setActiveAnalysis(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setTriggering(false);
    }
  }

  const completedAnalysis = activeAnalysis?.status === "completed" ? activeAnalysis : null;

  return (
    <div className="space-y-4">
      {/* Job selector + trigger */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Job to analyze against
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={triggering}
          >
            <option value="">Select a job…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleTrigger}
          disabled={!selectedJobId || triggering}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {triggering ? "Analyzing…" : "Run Analysis"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Past analysis selector */}
      {analyses.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {analyses.map((run, i) => (
            <button
              key={run.id}
              onClick={() => setActiveAnalysis(run)}
              className={`text-xs px-2 py-1 rounded border ${
                activeAnalysis?.id === run.id
                  ? "bg-blue-50 border-aubergine-300 text-blue-700"
                  : "border-stone-200 text-stone-500 hover:border-stone-300"
              }`}
            >
              Run {analyses.length - i} · {new Date(run.created_at).toLocaleDateString()}
            </button>
          ))}
        </div>
      )}

      {/* Active analysis status */}
      {activeAnalysis && activeAnalysis.status === "pending" && (
        <div className="text-sm text-stone-500 bg-stone-50 rounded px-3 py-2">
          Analysis in progress…
        </div>
      )}
      {activeAnalysis && activeAnalysis.status === "failed" && (
        <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
          Analysis failed. Please try again.
        </div>
      )}

      {completedAnalysis && <AnalysisView run={completedAnalysis} />}

      {/* Submittal draft — shown once an analysis is completed */}
      {completedAnalysis && (
        <div className="border-t border-stone-100 pt-5 mt-2">
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
              Submittal Draft
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Job-specific presentation grounded in this analysis · editable · included in export
            </p>
          </div>
          <SubmittalDraftPanel
            candidateId={candidateId}
            analysisRunId={completedAnalysis.id}
          />
        </div>
      )}

      {analyses.length === 0 && !triggering && (
        <p className="text-sm text-stone-400">
          No analyses yet. Select a job and click Run Analysis to evaluate this candidate.
        </p>
      )}
    </div>
  );
}
