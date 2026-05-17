export type ReviewEvidenceDTO = {
  id: string;
  evidence_text: string;
  model_confidence: number | null;
};

export type ReviewFieldDTO = {
  id: string;
  field_name: string;
  group: string;
  field_value: string | null;
  ai_extracted_value: string | null;
  confidence: number | null;
  status: string;
  source: string;
  edited_at: string | null;
  edited_by_user_id: string | null;
  evidence_snippets: ReviewEvidenceDTO[];
  is_missing_from_model: boolean;
  is_ambiguous_from_model: boolean;
  needs_attention: boolean;
};

export type ReviewLatestRunDTO = {
  id: string;
  run_index: number;
  status: string;
  missing_fields: string[];
  ambiguous_fields: string[];
  provider_model: string | null;
};

export type ReviewCandidateDTO = {
  id: string;
  organization_id: string;
  audio_upload_id: string;
  processing_stage: string;
  approval_status: string;
  extraction_status: string;
};

export type TranscriptSegmentDTO = {
  id: string;
  sequence_index: number;
  start_ms: number;
  end_ms: number;
  speaker_label: string | null;
  text: string;
};

export type TranscriptDetailDTO = {
  id: string;
  audio_upload_id: string;
  version: number;
  language: string | null;
  provider: string | null;
  status: string;
  full_text: string;
  segments: TranscriptSegmentDTO[];
  created_at: string;
  updated_at: string;
};

export type ReviewBundleResponse = {
  candidate: ReviewCandidateDTO;
  transcript: TranscriptDetailDTO | null;
  latest_extraction_run: ReviewLatestRunDTO | null;
  fields: ReviewFieldDTO[];
  audio_upload_id: string;
};

export type AuditTimelineEntryDTO = {
  id: string;
  created_at: string;
  action: string;
  actor_type: string;
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
};

export type AuditTimelineResponse = {
  entries: AuditTimelineEntryDTO[];
};

export type NarrativeGenerationDTO = {
  id: string;
  version: number;
  recruiter_summary: string;
  submittal_draft: string;
  generator_provider: string;
  context_meta: Record<string, unknown>;
  created_at: string;
  created_by_user_id: string | null;
};

export type NarrativeHistoryResponse = {
  versions: NarrativeGenerationDTO[];
};
