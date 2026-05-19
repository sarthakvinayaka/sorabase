import type { Node, Edge } from "@xyflow/react";
import type { ProposedColumn } from "./types";

// ─── Node types ─────────────────────────────────────────────────────────────

export type WorkflowNodeType =
  // Recruiting Mode nodes
  | "source" | "extraction" | "analysis" | "output"
  // General Mode additions
  | "transcript" | "summary" | "schema";

export type NodeStatus = "idle" | "configured" | "running" | "completed" | "error";

// Source
export type SourceInputMode = "transcript_paste" | "audio_upload" | "zoom" | "zoom_bot" | "browser_capture";

export interface SourceNodeData extends Record<string, unknown> {
  nodeType: "source";
  label: string;
  status: NodeStatus;
  inputMode: SourceInputMode;
  transcript: string;
  jobReference: string;
  conversationId?: string;
  // Zoom cloud-recording mode: populated when recruiter picks a recording
  zoomConversationId?: string;
  zoomMeetingId?: string;
  zoomCharCount?: number;
  zoomCreatedAt?: string;
  // Zoom bot mode: meeting URL → bot session lifecycle
  botMeetingUrl?: string;
  botMeetingLabel?: string;
  botAutoRun?: boolean;
  botSessionId?: string;        // BotSession.id (our UUID)
  botStatus?: string;           // mirrors BotSession.status for display
  botCandidateId?: string;      // populated once complete
  botTranscriptChars?: number;
  botErrorMessage?: string;
  // Browser capture mode (Chrome extension)
  captureConversationId?: string; // populated when extension completes
  captureLabel?: string;
  captureStatus?: "idle" | "recording" | "processing" | "done" | "error";
  captureError?: string;
}

// Extraction
export type FieldGroupId =
  | "identity" | "work_auth" | "work_style" | "experience"
  | "compensation" | "availability" | "recruiter_notes";

export type ExtractionTemplate   = "candidate_screening" | "quick_screen" | "recruiter_intake";
export type ConfidenceThreshold  = "high" | "medium" | "low";
export type MissingFieldBehavior = "mark_missing" | "skip_field";

export interface ExtractionFieldGroup {
  id: FieldGroupId;
  active: boolean;
}

export interface FieldGroupDef {
  id: FieldGroupId;
  label: string;
  fieldCount: number;
  description: string;
}

export interface ExtractionTemplateDef {
  id: ExtractionTemplate;
  label: string;
  description: string;
  recommended?: boolean;
  activeGroups: FieldGroupId[];
}

export const FIELD_GROUP_DEFS: FieldGroupDef[] = [
  { id: "identity",        label: "Identity & Contact",  fieldCount: 7,  description: "Name, email, phone, location" },
  { id: "work_auth",       label: "Work Authorization",  fieldCount: 4,  description: "Visa type, eligibility, relocation" },
  { id: "work_style",      label: "Work Style",          fieldCount: 2,  description: "Remote preference" },
  { id: "experience",      label: "Experience & Skills", fieldCount: 11, description: "Title, years, skills, companies, education" },
  { id: "compensation",    label: "Compensation",        fieldCount: 5,  description: "Salary range, compensation period" },
  { id: "availability",    label: "Availability",        fieldCount: 3,  description: "Notice period, start date, interview slots" },
  { id: "recruiter_notes", label: "Recruiter Notes",     fieldCount: 3,  description: "Fit summary, recommendation, concerns" },
];

const ALL_GROUP_IDS: FieldGroupId[] = [
  "identity", "work_auth", "work_style", "experience",
  "compensation", "availability", "recruiter_notes",
];

export const EXTRACTION_TEMPLATES: ExtractionTemplateDef[] = [
  {
    id: "candidate_screening",
    label: "Candidate Screening",
    description: "Full 35-field profile. Best for standard intake.",
    recommended: true,
    activeGroups: ALL_GROUP_IDS,
  },
  {
    id: "quick_screen",
    label: "Quick Screen",
    description: "Core fields only — identity, authorization, experience, availability.",
    activeGroups: ["identity", "work_auth", "experience", "availability"],
  },
  {
    id: "recruiter_intake",
    label: "Recruiter Intake",
    description: "All fields with recruiter notes. Use for detailed candidate files.",
    activeGroups: ALL_GROUP_IDS,
  },
];

export function templateDefaultGroups(templateId: ExtractionTemplate): ExtractionFieldGroup[] {
  const def = EXTRACTION_TEMPLATES.find((t) => t.id === templateId)!;
  return FIELD_GROUP_DEFS.map((g) => ({ id: g.id, active: def.activeGroups.includes(g.id) }));
}

export interface ExtractionNodeData extends Record<string, unknown> {
  nodeType: "extraction";
  label: string;
  status: NodeStatus;
  template: ExtractionTemplate;
  fieldGroups: ExtractionFieldGroup[];
  confidenceThreshold: ConfidenceThreshold;
  missingFieldBehavior: MissingFieldBehavior;
  includeEvidence: boolean;
  flagLowConfidence: boolean;
  candidateId?: string;
  extractionRunId?: string;
  extractedCount?: number;
  overallConfidence?: number;
}

// Analysis
export interface AnalysisNodeData extends Record<string, unknown> {
  nodeType: "analysis";
  label: string;
  status: NodeStatus;
  // JD input — recruiter pastes JD inline; jobId populated on first run
  jdTitle: string;
  jdText: string;
  jobId: string;
  includeRationale: boolean;
  // Post-run scoring — AI output (0-100 from backend, display ÷10)
  analysisRunId?: string;
  aiScore?: number;
  aiTier?: string;
  // Final score: override takes precedence; displayed as X/10
  finalScore?: number;
  scoreStatus?: "ai_scored" | "overridden";
}

// Output
// Dashboard is always-on and implicit. ExtraOutputFormat lists opt-in additions.
export type ExtraOutputFormat = "json" | "csv" | "api";
export type DataSource = "reviewed" | "extracted";

export interface OutputNodeData extends Record<string, unknown> {
  nodeType: "output";
  label: string;
  status: NodeStatus;
  // Dashboard is fixed — results always persist and navigate there.
  // extraFormats lists optional additional delivery formats on top.
  extraFormats: ExtraOutputFormat[];
  dataSource: DataSource;
  includeTranscript: boolean;
  includeStructuredData: boolean;
  includeAnalysis: boolean;
  includeEvidence: boolean;
  exportLabel: string;
  candidateId?: string;
}

// Transcript — read-only artifact (General Mode)
export interface TranscriptNodeData extends Record<string, unknown> {
  nodeType: "transcript";
  label: string;
  status: NodeStatus;
  charCount?: number;
  conversationId?: string;
  preview?: string;
}

// Summary — read-only artifact (General Mode)
export interface SummaryNodeData extends Record<string, unknown> {
  nodeType: "summary";
  label: string;
  status: NodeStatus;
  text?: string;
  extractionRunId?: string;
}

// Schema — AI proposal + column config (General Mode)
export type SchemaStatus = "empty" | "proposed" | "approved";

export interface SchemaNodeData extends Record<string, unknown> {
  nodeType: "schema";
  label: string;
  status: NodeStatus;
  schemaStatus: SchemaStatus;
  columns: ProposedColumn[];
  rationale?: string;
  templateId?: string;
  templateVersion?: number;
}

export type AnyNodeData =
  | SourceNodeData
  | ExtractionNodeData
  | AnalysisNodeData
  | OutputNodeData
  | TranscriptNodeData
  | SummaryNodeData
  | SchemaNodeData;

// ─── React Flow node / edge aliases ─────────────────────────────────────────

// Loose node type for the store array — components cast data to specific types.
export type WorkflowNode = Node<Record<string, unknown>>;
export type WorkflowEdge = Edge;

// ─── Run log ────────────────────────────────────────────────────────────────

export type LogLevel = "info" | "success" | "error" | "warn";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
}

export type RunState = "idle" | "running" | "paused" | "completed" | "error";

// ─── Node library palette ────────────────────────────────────────────────────

export interface PaletteItem {
  type: WorkflowNodeType;
  label: string;
  description: string;
  accent: string;      // Tailwind bg-* color class for the accent stripe
  icon: string;        // emoji or character used as icon
  comingSoon?: boolean;
}

export const NODE_PALETTE: PaletteItem[] = [
  {
    type: "source",
    label: "Source",
    description: "Transcript or audio input",
    accent: "bg-stone-400",
    icon: "◎",
  },
  {
    type: "extraction",
    label: "Extraction",
    description: "35-field structured profile",
    accent: "bg-teal-500",
    icon: "⊞",
  },
  {
    type: "analysis",
    label: "AI Scoring",
    description: "JD fit scoring & rationale",
    accent: "bg-amber-500",
    icon: "◈",
  },
  {
    type: "output",
    label: "Output",
    description: "Dashboard + optional exports",
    accent: "bg-emerald-500",
    icon: "↑",
  },
];

export const GENERAL_NODE_PALETTE: PaletteItem[] = [
  {
    type: "source",
    label: "Input",
    description: "Paste, upload, or meeting link",
    accent: "bg-stone-400",
    icon: "◎",
  },
  {
    type: "transcript",
    label: "Transcript",
    description: "Conversation text artifact",
    accent: "bg-blue-400",
    icon: "≡",
  },
  {
    type: "schema",
    label: "Schema",
    description: "AI column proposal + editor",
    accent: "bg-violet-500",
    icon: "⊟",
  },
  {
    type: "extraction",
    label: "Extraction",
    description: "Extract fields from schema",
    accent: "bg-teal-500",
    icon: "⊞",
  },
  {
    type: "summary",
    label: "Summary",
    description: "AI-generated meeting summary",
    accent: "bg-amber-400",
    icon: "◈",
  },
  {
    type: "output",
    label: "Output",
    description: "Results, exports, webhooks",
    accent: "bg-emerald-500",
    icon: "↑",
  },
];

// ─── Connection validation ───────────────────────────────────────────────────

export const VALID_CONNECTIONS: Record<WorkflowNodeType, WorkflowNodeType[]> = {
  // Recruiting Mode
  source:     ["analysis", "extraction", "output", "transcript", "schema"],
  analysis:   ["extraction", "output"],
  extraction: ["output", "summary"],
  output:     [],
  // General Mode additions
  transcript: ["schema", "extraction", "summary"],
  schema:     ["extraction"],
  summary:    ["output"],
};
