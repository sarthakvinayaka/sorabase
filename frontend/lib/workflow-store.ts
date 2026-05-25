"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { nanoid } from "./nanoid";
import {
  templateDefaultGroups,
  type AnalysisNodeData,
  type AnyNodeData,
  type ExtractionNodeData,
  type LogEntry,
  type LogLevel,
  type OutputNodeData,
  type RunState,
  type SchemaNodeData,
  type SourceNodeData,
  type SummaryNodeData,
  type TranscriptNodeData,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowNodeType,
  // Study Mode types
  type LecCaptureNodeData,
  type LecUploadNodeData,
  type TranscriptCleanerNodeData,
  type ConceptExtractorNodeData,
  type DefinitionExtractorNodeData,
  type FormulaExtractorNodeData,
  type QuestionGenNodeData,
  type FlashcardGenNodeData,
  type QuizGenNodeData,
  type StudyOutputNodeData,
} from "./workflow-types";

// ─── Default node data ────────────────────────────────────────────────────────

const defaultSourceData: SourceNodeData = {
  nodeType: "source",
  label: "Source",
  status: "idle",
  inputMode: "transcript_paste",
  transcript: "",
  jobReference: "",
};

const defaultAnalysisData: AnalysisNodeData = {
  nodeType: "analysis",
  label: "AI Scoring",
  status: "idle",
  jdTitle: "",
  jdText: "",
  jobId: "",
  includeRationale: true,
};

const defaultExtractionData: ExtractionNodeData = {
  nodeType: "extraction",
  label: "Extraction",
  status: "idle",
  template: "candidate_screening",
  fieldGroups: templateDefaultGroups("candidate_screening"),
  confidenceThreshold: "medium",
  missingFieldBehavior: "mark_missing",
  includeEvidence: true,
  flagLowConfidence: true,
};

const defaultOutputData: OutputNodeData = {
  nodeType: "output",
  label: "Output",
  status: "idle",
  extraFormats: [],
  dataSource: "reviewed",
  includeTranscript: false,
  includeStructuredData: true,
  includeAnalysis: true,
  includeEvidence: false,
  exportLabel: "",
};

// ─── Recruiting mode ──────────────────────────────────────────────────────────

const RECRUITING_INITIAL_NODES: WorkflowNode[] = [
  { id: "source-1",   type: "source",     position: { x: 60,  y: 160 }, data: defaultSourceData },
  { id: "analysis-1", type: "analysis",   position: { x: 340, y: 160 }, data: defaultAnalysisData },
  { id: "extract-1",  type: "extraction", position: { x: 620, y: 160 }, data: defaultExtractionData },
  { id: "output-1",   type: "output",     position: { x: 900, y: 160 }, data: defaultOutputData },
];

const RECRUITING_INITIAL_EDGES: WorkflowEdge[] = [
  { id: "e-src-ana", source: "source-1",   target: "analysis-1", type: "smoothstep" },
  { id: "e-ana-ext", source: "analysis-1", target: "extract-1",  type: "smoothstep" },
  { id: "e-ext-out", source: "extract-1",  target: "output-1",   type: "smoothstep" },
];

export const RECRUITING_CORE_NODE_IDS = new Set(["source-1", "analysis-1", "extract-1", "output-1"]);
export const RECRUITING_CORE_EDGE_IDS = new Set(["e-src-ana", "e-ana-ext", "e-ext-out"]);

// Legacy aliases — existing imports that haven't migrated to context still work
export const CORE_NODE_IDS = RECRUITING_CORE_NODE_IDS;
export const CORE_EDGE_IDS = RECRUITING_CORE_EDGE_IDS;

// ─── General mode ─────────────────────────────────────────────────────────────

const defaultTranscriptData: TranscriptNodeData = {
  nodeType: "transcript",
  label:    "Transcript",
  status:   "idle",
};

const defaultSummaryData: SummaryNodeData = {
  nodeType: "summary",
  label:    "Summary",
  status:   "idle",
};

const defaultSchemaData: SchemaNodeData = {
  nodeType:     "schema",
  label:        "Schema",
  status:       "idle",
  schemaStatus: "empty",
  columns:      [],
};

const GENERAL_INITIAL_NODES: WorkflowNode[] = [
  { id: "source-1",     type: "source",     position: { x: 60,   y: 180 }, data: defaultSourceData     },
  { id: "transcript-1", type: "transcript", position: { x: 320,  y: 180 }, data: defaultTranscriptData },
  { id: "schema-1",     type: "schema",     position: { x: 580,  y: 180 }, data: defaultSchemaData     },
  { id: "extract-1",    type: "extraction", position: { x: 840,  y: 180 }, data: defaultExtractionData },
  { id: "summary-1",    type: "summary",    position: { x: 1100, y: 180 }, data: defaultSummaryData    },
  { id: "output-1",     type: "output",     position: { x: 1360, y: 180 }, data: defaultOutputData     },
];

const GENERAL_INITIAL_EDGES: WorkflowEdge[] = [
  { id: "e-src-trn",  source: "source-1",     target: "transcript-1", type: "smoothstep" },
  { id: "e-trn-sch",  source: "transcript-1", target: "schema-1",     type: "smoothstep" },
  { id: "e-sch-ext",  source: "schema-1",     target: "extract-1",    type: "smoothstep" },
  { id: "e-ext-sum",  source: "extract-1",    target: "summary-1",    type: "smoothstep" },
  { id: "e-sum-out",  source: "summary-1",    target: "output-1",     type: "smoothstep" },
];

export const GENERAL_CORE_NODE_IDS = new Set([
  "source-1", "transcript-1", "schema-1", "extract-1", "summary-1", "output-1",
]);
export const GENERAL_CORE_EDGE_IDS = new Set([
  "e-src-trn", "e-trn-sch", "e-sch-ext", "e-ext-sum", "e-sum-out",
]);

// ─── Store interface ──────────────────────────────────────────────────────────

export interface WorkflowStore {
  // Canvas state
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedLibraryNodeType: WorkflowNodeType | null;

  // Run state
  runState: RunState;
  logEntries: LogEntry[];

  // UI
  isDark: boolean;
  logOpen: boolean;

  // React Flow event handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Node management
  addNode: (type: WorkflowNodeType, position: XYPosition) => string;
  addNodeAuto: (type: WorkflowNodeType) => string;
  updateNodeData: (id: string, patch: Partial<Record<string, unknown>>) => void;
  removeNode: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedLibraryNode: (type: WorkflowNodeType | null) => void;
  resetWorkflow: () => void;
  newCandidate: () => void;

  // Run lifecycle (API calls happen in WorkflowBuilder)
  setRunState: (state: RunState) => void;
  appendLog: (message: string, level?: LogLevel) => void;
  clearLog: () => void;

  // UI
  toggleDark: () => void;
  toggleLog: () => void;
}

// ─── Default data factory ─────────────────────────────────────────────────────

function makeDefaultData(type: WorkflowNodeType, label: string): AnyNodeData {
  switch (type) {
    case "source":
      return { nodeType: "source", label, status: "idle", inputMode: "transcript_paste", transcript: "", jobReference: "" };
    case "extraction":
      return {
        nodeType: "extraction", label, status: "idle",
        template: "candidate_screening" as const,
        fieldGroups: templateDefaultGroups("candidate_screening"),
        confidenceThreshold: "medium" as const,
        missingFieldBehavior: "mark_missing" as const,
        includeEvidence: true,
        flagLowConfidence: true,
      };
    case "analysis": {
      const d: AnalysisNodeData = { nodeType: "analysis", label: "AI Scoring", status: "idle", jdTitle: "", jdText: "", jobId: "", includeRationale: true };
      return d;
    }
    case "output":
      return {
        nodeType: "output", label, status: "idle",
        extraFormats: [], dataSource: "reviewed",
        includeTranscript: false, includeStructuredData: true,
        includeAnalysis: true, includeEvidence: false, exportLabel: "",
      };
    case "transcript":
      return { nodeType: "transcript", label, status: "idle" };
    case "summary":
      return { nodeType: "summary", label, status: "idle" };
    case "schema":
      return { nodeType: "schema", label, status: "idle", schemaStatus: "empty", columns: [] };
    // ── Study Mode ──────────────────────────────────────────────────────────
    case "lec_capture":
      return { nodeType: "lec_capture", label, status: "idle", captureMode: "paste", transcript: "", lectureTitle: "", courseName: "", lectureDate: "" } satisfies LecCaptureNodeData;
    case "lec_upload":
      return { nodeType: "lec_upload", label, status: "idle", format: "audio", lectureTitle: "", courseName: "", lectureDate: "" } satisfies LecUploadNodeData;
    case "transcript_cleaner":
      return { nodeType: "transcript_cleaner", label, status: "idle", preset: "lecture", removeFiller: true, fixSpeakerLabels: true, collapseRepetitions: true } satisfies TranscriptCleanerNodeData;
    case "concept_extractor":
      return { nodeType: "concept_extractor", label, status: "idle", maxConcepts: 15, confidenceThreshold: "medium", includeEvidence: true } satisfies ConceptExtractorNodeData;
    case "definition_extractor":
      return { nodeType: "definition_extractor", label, status: "idle", maxDefinitions: 20, includeContext: true } satisfies DefinitionExtractorNodeData;
    case "formula_extractor":
      return { nodeType: "formula_extractor", label, status: "idle", includeDerivations: false, includeUnits: true } satisfies FormulaExtractorNodeData;
    case "question_gen":
      return { nodeType: "question_gen", label, status: "idle", template: "lecture_notes", maxQuestions: 20, includeShortAnswer: true, includeExamQ: true, includeCompare: true, includeApplied: false } satisfies QuestionGenNodeData;
    case "flashcard_gen":
      return { nodeType: "flashcard_gen", label, status: "idle", includeConcepts: true, includeDefinitions: true, includeFormulas: true, includeQuestions: true, includeTopics: true, maxCards: 50 } satisfies FlashcardGenNodeData;
    case "quiz_gen":
      return { nodeType: "quiz_gen", label, status: "idle", includeMcq: true, includeTrueFalse: true, includeShortAnswer: true, includeMatching: true, includeFillBlank: true, maxQuestions: 20, difficultyMix: "balanced" } satisfies QuizGenNodeData;
    case "study_output":
      return { nodeType: "study_output", label, status: "idle", autoArchive: false, exportJson: false, exportCsv: false, exportAnki: false, packTitle: "" } satisfies StudyOutputNodeData;
  }
}

// ─── Store factory ────────────────────────────────────────────────────────────

interface StoreOptions {
  storageKey:   string;
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  coreNodeIds:  Set<string>;
  coreEdgeIds:  Set<string>;
}

function createWorkflowStore({
  storageKey,
  initialNodes,
  initialEdges,
  coreNodeIds,
  coreEdgeIds,
}: StoreOptions) {
  return create<WorkflowStore>()(
    persist(
      (set, get) => ({
        nodes:                   initialNodes,
        edges:                   initialEdges,
        selectedNodeId:          null,
        selectedLibraryNodeType: null,
        runState:                "idle",
        logEntries:              [],
        isDark:                  false,
        logOpen:                 false,

        onNodesChange: (changes) => {
          const safe = changes.filter((c) => !(c.type === "remove" && coreNodeIds.has(c.id)));
          set({ nodes: applyNodeChanges(safe, get().nodes as never) as unknown as WorkflowNode[] });
        },

        onEdgesChange: (changes) => {
          const safe = changes.filter((c) => !(c.type === "remove" && coreEdgeIds.has(c.id)));
          set({ edges: applyEdgeChanges(safe, get().edges as never) as unknown as WorkflowEdge[] });
        },

        onConnect: (connection) => {
          set({
            edges: addEdge(
              { ...connection, type: "smoothstep" },
              get().edges as never,
            ) as unknown as WorkflowEdge[],
          });
        },

        addNode: (type, position) => {
          const labels: Record<WorkflowNodeType, string> = {
            source: "Source", extraction: "Extraction",
            analysis: "AI Scoring", output: "Output",
            transcript: "Transcript", summary: "Summary", schema: "Schema",
            lec_capture: "Lecture Capture", lec_upload: "Lecture Upload",
            transcript_cleaner: "Transcript Cleaner", concept_extractor: "Concept Extractor",
            definition_extractor: "Definition Extractor", formula_extractor: "Formula Extractor",
            question_gen: "Questions", flashcard_gen: "Flashcard Generator",
            quiz_gen: "Quiz Generator", study_output: "Study Pack Output",
          };
          const id      = `${type}-${nanoid()}`;
          const newNode: WorkflowNode = { id, type, position, data: makeDefaultData(type, labels[type]) };
          set({ nodes: [...get().nodes, newNode] });
          return id;
        },

        addNodeAuto: (type) => {
          const labels: Record<WorkflowNodeType, string> = {
            source: "Source", extraction: "Extraction",
            analysis: "AI Scoring", output: "Output",
            transcript: "Transcript", summary: "Summary", schema: "Schema",
            lec_capture: "Lecture Capture", lec_upload: "Lecture Upload",
            transcript_cleaner: "Transcript Cleaner", concept_extractor: "Concept Extractor",
            definition_extractor: "Definition Extractor", formula_extractor: "Formula Extractor",
            question_gen: "Questions", flashcard_gen: "Flashcard Generator",
            quiz_gen: "Quiz Generator", study_output: "Study Pack Output",
          };
          const { nodes } = get();
          const maxX  = nodes.reduce((m, n) => Math.max(m, n.position.x), 0);
          const row   = Math.floor(nodes.length / 4);
          const col   = nodes.length % 4;
          const position: XYPosition = nodes.length < 8
            ? { x: maxX + 280, y: 160 + row * 180 }
            : { x: 60 + col * 280, y: 160 + row * 180 };
          const id      = `${type}-${nanoid()}`;
          const newNode: WorkflowNode = { id, type, position, data: makeDefaultData(type, labels[type]) };
          set({ nodes: [...get().nodes, newNode], selectedNodeId: id, selectedLibraryNodeType: null });
          return id;
        },

        updateNodeData: (id, patch) => {
          set({
            nodes: get().nodes.map((n) =>
              n.id === id ? { ...n, data: { ...(n.data as Record<string, unknown>), ...patch } } : n,
            ),
          });
        },

        removeNode: (id) => {
          if (coreNodeIds.has(id)) return;
          const { nodes, edges, selectedNodeId } = get();
          set({
            nodes:          nodes.filter((n) => n.id !== id),
            edges:          edges.filter((e) => e.source !== id && e.target !== id),
            selectedNodeId: selectedNodeId === id ? null : selectedNodeId,
          });
        },

        setSelectedNode: (id) => set({ selectedNodeId: id, selectedLibraryNodeType: null }),

        setSelectedLibraryNode: (type) => set({ selectedLibraryNodeType: type, selectedNodeId: null }),

        resetWorkflow: () => set({
          nodes:                   initialNodes,
          edges:                   initialEdges,
          selectedNodeId:          null,
          selectedLibraryNodeType: null,
          runState:                "idle",
          logEntries:              [],
        }),

        newCandidate: () => {
          const updatedNodes = get().nodes.map((n) => {
            const d = n.data as Record<string, unknown>;
            switch (n.type) {
              case "source": {
                const src = d as SourceNodeData;
                return {
                  ...n,
                  data: {
                    ...defaultSourceData,
                    inputMode: src.inputMode,
                  },
                };
              }
              case "analysis": {
                const ana = d as AnalysisNodeData;
                return {
                  ...n,
                  data: {
                    ...defaultAnalysisData,
                    jdTitle:          ana.jdTitle,
                    jdText:           ana.jdText,
                    jobId:            ana.jobId,
                    includeRationale: ana.includeRationale,
                  },
                };
              }
              case "extraction": {
                const ext = d as ExtractionNodeData;
                return {
                  ...n,
                  data: {
                    ...defaultExtractionData,
                    template:             ext.template,
                    fieldGroups:          ext.fieldGroups,
                    confidenceThreshold:  ext.confidenceThreshold,
                    missingFieldBehavior: ext.missingFieldBehavior,
                    includeEvidence:      ext.includeEvidence,
                    flagLowConfidence:    ext.flagLowConfidence,
                  },
                };
              }
              case "output": {
                const out = d as OutputNodeData;
                return {
                  ...n,
                  data: {
                    ...defaultOutputData,
                    extraFormats:          out.extraFormats,
                    dataSource:            out.dataSource,
                    includeTranscript:     out.includeTranscript,
                    includeStructuredData: out.includeStructuredData,
                    includeAnalysis:       out.includeAnalysis,
                    includeEvidence:       out.includeEvidence,
                    exportLabel:           out.exportLabel,
                  },
                };
              }
              case "transcript": {
                return { ...n, data: { ...defaultTranscriptData } };
              }
              case "summary": {
                return { ...n, data: { ...defaultSummaryData } };
              }
              case "schema": {
                const sch = d as SchemaNodeData;
                // Keep columns/template — they're configuration, not run state
                return {
                  ...n,
                  data: {
                    ...defaultSchemaData,
                    columns:         sch.columns,
                    schemaStatus:    sch.columns.length > 0 ? ("approved" as const) : ("empty" as const),
                    status:          sch.columns.length > 0 ? ("configured" as const) : ("idle" as const),
                    templateId:      sch.templateId,
                    templateVersion: sch.templateVersion,
                    rationale:       sch.rationale,
                  },
                };
              }
              default:
                return { ...n, data: { ...d, status: "idle" as const } };
            }
          });
          set({ nodes: updatedNodes, selectedNodeId: null, selectedLibraryNodeType: null, runState: "idle", logEntries: [] });
        },

        setRunState: (state) => set({ runState: state }),

        appendLog: (message, level = "info") => {
          const entry: LogEntry = { id: nanoid(), ts: Date.now(), level, message };
          set({ logEntries: [...get().logEntries, entry], logOpen: true });
        },

        clearLog: () => set({ logEntries: [] }),

        toggleDark: () => set({ isDark: !get().isDark }),

        toggleLog: () => set({ logOpen: !get().logOpen }),
      }),
      {
        name: storageKey,
        // v1 persisted the full node objects, which included React Flow internals
        // (measured, positionAbsolute, width, height, selected, dragging) written
        // back by applyNodeChanges. On reload RF received those stale internals,
        // mismatched handle bounds, and skipped its measurement cycle — causing
        // edges not to render and fitView to run against a 0-height container.
        // v2 strips everything RF added so RF always initializes from clean data.
        version: 2,
        migrate: (persisted: unknown, version: number) => {
          const s = persisted as { nodes?: unknown[]; edges?: unknown[]; isDark?: boolean };
          if (version < 2) {
            return {
              ...s,
              nodes: (s.nodes ?? initialNodes).map((n: unknown) => {
                const { id, type, position, data } = n as WorkflowNode;
                return { id, type, position, data };
              }),
              // v1 may have persisted empty edges from a previous bug; restore defaults
              edges: (s.edges && s.edges.length > 0) ? s.edges : initialEdges,
            };
          }
          return s;
        },
        // If a v2 store somehow has empty edges (e.g. from a reset that was
        // persisted before initial edges were re-set), restore the initial edges
        // rather than leaving the canvas disconnected.
        merge: (persisted, current) => {
          // persisted is undefined when localStorage has no entry yet (first-ever visit).
          // Spreading undefined is safe in JS but accessing p.edges would throw — guard it.
          const p = (persisted ?? {}) as Partial<typeof current>;
          return {
            ...current,
            ...p,
            edges: (p.edges && p.edges.length > 0) ? p.edges : current.edges,
          };
        },
        partialize: (s) => ({
          // Only persist user-controlled fields — never RF internals.
          nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
          edges: s.edges.map(({ id, source, target, sourceHandle, targetHandle, type: t, data }) => ({
            id, source, target, type: t, data,
            ...(sourceHandle ? { sourceHandle } : {}),
            ...(targetHandle ? { targetHandle } : {}),
          })),
          isDark: s.isDark,
        }),
      },
    ),
  );
}

// ─── Store instances ──────────────────────────────────────────────────────────

export const useWorkflowStore = createWorkflowStore({
  storageKey:   "sorabase-workflow-v1",
  initialNodes: RECRUITING_INITIAL_NODES,
  initialEdges: RECRUITING_INITIAL_EDGES,
  coreNodeIds:  RECRUITING_CORE_NODE_IDS,
  coreEdgeIds:  RECRUITING_CORE_EDGE_IDS,
});

export const useGeneralWorkflowStore = createWorkflowStore({
  storageKey:   "sorabase-general-workflow-v1",
  initialNodes: GENERAL_INITIAL_NODES,
  initialEdges: GENERAL_INITIAL_EDGES,
  coreNodeIds:  GENERAL_CORE_NODE_IDS,
  coreEdgeIds:  GENERAL_CORE_EDGE_IDS,
});

// ─── Study Mode ───────────────────────────────────────────────────────────────

const STUDY_INITIAL_NODES: WorkflowNode[] = [
  { id: "lec-capture-1",    type: "lec_capture",        position: { x: 60,   y: 180 }, data: makeDefaultData("lec_capture",        "Lecture Capture")    },
  { id: "transcript-cln-1", type: "transcript_cleaner", position: { x: 320,  y: 180 }, data: makeDefaultData("transcript_cleaner", "Transcript Cleaner") },
  { id: "concept-ext-1",    type: "concept_extractor",  position: { x: 580,  y: 180 }, data: makeDefaultData("concept_extractor",  "Concept Extractor")  },
  { id: "question-gen-1",   type: "question_gen",       position: { x: 840,  y: 180 }, data: makeDefaultData("question_gen",       "Questions")          },
  { id: "flashcard-gen-1",  type: "flashcard_gen",      position: { x: 1100, y: 180 }, data: makeDefaultData("flashcard_gen",      "Flashcard Generator") },
  { id: "study-output-1",   type: "study_output",       position: { x: 1360, y: 180 }, data: makeDefaultData("study_output",       "Study Pack Output")  },
];

const STUDY_INITIAL_EDGES: WorkflowEdge[] = [
  { id: "e-cap-cln",  source: "lec-capture-1",    target: "transcript-cln-1", type: "smoothstep" },
  { id: "e-cln-cxt",  source: "transcript-cln-1", target: "concept-ext-1",   type: "smoothstep" },
  { id: "e-cxt-qgen", source: "concept-ext-1",    target: "question-gen-1",  type: "smoothstep" },
  { id: "e-qgen-fgen",source: "question-gen-1",   target: "flashcard-gen-1", type: "smoothstep" },
  { id: "e-fgen-out", source: "flashcard-gen-1",  target: "study-output-1",  type: "smoothstep" },
];

export const STUDY_CORE_NODE_IDS = new Set([
  "lec-capture-1", "transcript-cln-1", "concept-ext-1",
  "question-gen-1", "flashcard-gen-1", "study-output-1",
]);
export const STUDY_CORE_EDGE_IDS = new Set([
  "e-cap-cln", "e-cln-cxt", "e-cxt-qgen", "e-qgen-fgen", "e-fgen-out",
]);

export const useStudyWorkflowStore = createWorkflowStore({
  storageKey:   "sorabase-study-workflow-v1",
  initialNodes: STUDY_INITIAL_NODES,
  initialEdges: STUDY_INITIAL_EDGES,
  coreNodeIds:  STUDY_CORE_NODE_IDS,
  coreEdgeIds:  STUDY_CORE_EDGE_IDS,
});
