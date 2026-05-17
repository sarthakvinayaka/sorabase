import type { NodeTypes } from "@xyflow/react";
import SourceNode from "./SourceNode";
import ExtractionNode from "./ExtractionNode";
import AnalysisNode from "./AnalysisNode";
import OutputNode from "./OutputNode";
import TranscriptNode from "./TranscriptNode";
import SummaryNode from "./SummaryNode";
import SchemaNode from "./SchemaNode";

export const nodeTypes: NodeTypes = {
  // Recruiting Mode
  source:     SourceNode,
  extraction: ExtractionNode,
  analysis:   AnalysisNode,
  output:     OutputNode,
  // General Mode additions
  transcript: TranscriptNode,
  summary:    SummaryNode,
  schema:     SchemaNode,
};
