import React from "react";
import { render, screen } from "@testing-library/react";
import ReviewWorkspace from "@/app/review/[candidateId]/ReviewWorkspace";
import type { CandidateDetail } from "@/lib/types";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("next/link", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockLink({ href, children, ...rest }: any) {
    return <a href={href} {...rest}>{children}</a>;
  };
});

jest.mock("@/lib/api", () => ({
  updateApproval:      jest.fn(),
  confirmField:        jest.fn(),
  getCandidateAudit:   jest.fn().mockResolvedValue({ entries: [] }),
  ApiError:            class ApiError extends Error { detail = ""; },
}));

jest.mock("@/components/review/FieldRow",           () => ({ __esModule: true, default: () => <tr data-testid="field-row" /> }));
jest.mock("@/components/review/MissingFieldsBanner",() => ({ __esModule: true, default: () => null }));
jest.mock("@/components/review/ExportButton",       () => ({ __esModule: true, default: () => <button>Export</button> }));
jest.mock("@/components/review/AnalysisPanel",      () => ({ AnalysisPanel: () => null }));
jest.mock("@/components/review/SummaryDraftPanel",  () => ({ SummaryDraftPanel: () => null }));

// ── Fixture ──────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

function makeDetail(overrides: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    candidate: {
      id: "cand-1",
      org_id: "org-1",
      latest_extraction_run_id: "ext-1",
      approval_status: "needs_review",
      created_at: NOW,
      updated_at: NOW,
      ...overrides.candidate,
    },
    extraction: {
      id: "ext-1",
      conversation_id: "conv-1",
      candidate_id: "cand-1",
      missing_fields: [],
      ambiguous_fields: [],
      suggested_follow_up_questions: [],
      candidate_summary: null,
      overall_confidence: 0.87,
      model_used: "gpt-4o",
      status: "completed",
      created_at: NOW,
      ...overrides.extraction,
    },
    fields: overrides.fields ?? [],
    conversation: {
      id: "conv-1",
      source_type: "transcript_paste",
      status: "processed",
      raw_text: "Alice: Hi, I have 5 years of Python experience.",
      char_count: 50,
      recruiter_id: null,
      job_reference: "SWE-2024",
      job_id: null,
      candidate_id: "cand-1",
      created_at: NOW,
      ...overrides.conversation,
    },
  };
}

function makeField(name: string, value: string, status = "extracted") {
  return {
    id: `f-${name}`,
    field_name: name,
    raw_value: value,
    normalized_value: value,
    reviewed_value: null,
    evidence_snippet: null,
    confidence: 0.9,
    status,
    edited: false,
    created_at: NOW,
    updated_at: NOW,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ReviewWorkspace", () => {
  it("renders the page header and back link", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByRole("link", { name: /candidate queue/i })).toHaveAttribute("href", "/candidates");
  });

  it("shows the candidate name in the heading when full_name field is present", () => {
    const detail = makeDetail({ fields: [makeField("full_name", "Alice Smith")] });
    render(<ReviewWorkspace initial={detail} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Alice Smith");
  });

  it('falls back to "Candidate review" heading when no full_name field', () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Candidate review");
  });

  it("renders the AI summary when present", () => {
    const detail = makeDetail({ extraction: { candidate_summary: "Strong Python background." } as never });
    render(<ReviewWorkspace initial={detail} />);
    expect(screen.getByText("Strong Python background.")).toBeInTheDocument();
  });

  it("renders extracted fields table with a FieldRow per extracted field", () => {
    const detail = makeDetail({
      fields: [
        makeField("full_name",   "Alice Smith"),
        makeField("years_exp",   "5"),
        makeField("location",    "London"),
      ],
    });
    render(<ReviewWorkspace initial={detail} />);
    // FieldRow mock renders a <tr> — at least one must be present
    expect(screen.getAllByTestId("field-row").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Approve and Reject buttons for needs_review status", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("shows confidence percentage in meta chips", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByText(/confidence: 87%/i)).toBeInTheDocument();
  });

  it("shows the job reference in meta chips when present", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByText(/SWE-2024/)).toBeInTheDocument();
  });

  it("renders the audit trail toggle button", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByRole("button", { name: /audit trail/i })).toBeInTheDocument();
  });

  it("renders the source transcript toggle button", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByRole("button", { name: /source transcript/i })).toBeInTheDocument();
  });

  it("renders the export button", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    // ExportButton is mocked; getAllByRole guards against duplicate matches
    expect(screen.getAllByRole("button", { name: /export/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("does not crash with zero extracted fields (empty extraction)", () => {
    const detail = makeDetail({ fields: [] });
    const { container } = render(<ReviewWorkspace initial={detail} />);
    expect(container).toBeTruthy();
  });

  it("shows model and timestamp footer", () => {
    render(<ReviewWorkspace initial={makeDetail()} />);
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument();
  });
});
