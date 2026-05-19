import type { NodeTypes } from "@xyflow/react";
import SourceNode from "./SourceNode";
import ExtractionNode from "./ExtractionNode";
import AnalysisNode from "./AnalysisNode";
import OutputNode from "./OutputNode";
import TranscriptNode from "./TranscriptNode";
import SummaryNode from "./SummaryNode";
import SchemaNode from "./SchemaNode";
// Study Mode nodes
import LecCaptureNode from "./LecCaptureNode";
import LecUploadNode from "./LecUploadNode";
import TranscriptCleanerNode from "./TranscriptCleanerNode";
import ConceptExtractorNode from "./ConceptExtractorNode";
import DefinitionExtractorNode from "./DefinitionExtractorNode";
import FormulaExtractorNode from "./FormulaExtractorNode";
import QuestionGenNode from "./QuestionGenNode";
import FlashcardGenNode from "./FlashcardGenNode";
import QuizGenNode from "./QuizGenNode";
import StudyOutputNode from "./StudyOutputNode";

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
  // Study Mode
  lec_capture:          LecCaptureNode,
  lec_upload:           LecUploadNode,
  transcript_cleaner:   TranscriptCleanerNode,
  concept_extractor:    ConceptExtractorNode,
  definition_extractor: DefinitionExtractorNode,
  formula_extractor:    FormulaExtractorNode,
  question_gen:         QuestionGenNode,
  flashcard_gen:        FlashcardGenNode,
  quiz_gen:             QuizGenNode,
  study_output:         StudyOutputNode,
};
