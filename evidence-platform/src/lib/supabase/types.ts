export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CaseStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type Materiality = "low" | "medium" | "high";
export type StakesLevel = "low" | "medium" | "high";
export type EvidenceRelationship =
  | "supports"
  | "partially_supports"
  | "contradicts"
  | "context_only"
  | "not_relevant";
export type SourceIdentityStatus =
  | "verified"
  | "metadata_only"
  | "unresolved"
  | "not_found"
  | "invalid";
export type DoiStatus =
  | "valid_found"
  | "valid_not_found"
  | "invalid_format"
  | "network_error"
  | "crossref_found"
  | "datacite_found"
  | "retracted"
  | "corrected"
  | "metadata_mismatch"
  | "unknown";
export type RetractionStatus = "current" | "retracted" | "corrected" | "unknown";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ProfileRole = "owner" | "admin" | "member";
export type CommitmentStatus = "active" | "fulfilled" | "expired" | "cancelled";

export type PublicVerdict =
  | "VERIFIED_ENOUGH_TO_ACT"
  | "PARTIALLY_SUPPORTED"
  | "MIXED_OR_UNCERTAIN"
  | "UNVERIFIABLE"
  | "CONTRADICTED"
  | "REQUIRES_QUALIFIED_REVIEW";

export type CommitmentVerdict =
  | "CONSISTENT"
  | "PARTIALLY_CONSISTENT"
  | "CONTRADICTED"
  | "NOT_EVALUABLE";

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          display_name: string | null;
          role: ProfileRole;
          terms_accepted: boolean;
          terms_accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          display_name?: string | null;
          role?: ProfileRole;
          terms_accepted?: boolean;
          terms_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          display_name?: string | null;
          role?: ProfileRole;
          terms_accepted?: boolean;
          terms_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      verification_cases: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          title: string;
          input_type: string;
          raw_input: string | null;
          source_url: string | null;
          file_path: string | null;
          status: CaseStatus;
          pipeline_stage: string | null;
          domain: string | null;
          stakes_level: StakesLevel | null;
          materiality: Materiality | null;
          public_verdict: PublicVerdict | null;
          score: number | null;
          score_version: string | null;
          user_context: Json;
          error_message: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          title: string;
          input_type: string;
          raw_input?: string | null;
          source_url?: string | null;
          file_path?: string | null;
          status?: CaseStatus;
          pipeline_stage?: string | null;
          domain?: string | null;
          stakes_level?: StakesLevel | null;
          materiality?: Materiality | null;
          public_verdict?: PublicVerdict | null;
          score?: number | null;
          score_version?: string | null;
          user_context?: Json;
          error_message?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string;
          title?: string;
          input_type?: string;
          raw_input?: string | null;
          source_url?: string | null;
          file_path?: string | null;
          status?: CaseStatus;
          pipeline_stage?: string | null;
          domain?: string | null;
          stakes_level?: StakesLevel | null;
          materiality?: Materiality | null;
          public_verdict?: PublicVerdict | null;
          score?: number | null;
          score_version?: string | null;
          user_context?: Json;
          error_message?: string | null;
          completed_at?: string | null;
          completed_at_?: string | null;
        };
        Relationships: [];
      };
      extracted_claims: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          claim_text: string;
          claim_type: string;
          is_verifiable: boolean;
          confidence: number | null;
          source_location: Json | null;
          extraction_model: string | null;
          prompt_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          claim_text: string;
          claim_type: string;
          is_verifiable?: boolean;
          confidence?: number | null;
          source_location?: Json | null;
          extraction_model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          organization_id?: string;
          claim_text?: string;
          claim_type?: string;
          is_verifiable?: boolean;
          confidence?: number | null;
          source_location?: Json | null;
          extraction_model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      evidence_sources: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          source_type: "doi" | "url" | "upload";
          raw_identifier: string;
          normalized_identifier: string | null;
          title: string | null;
          authors: string[] | null;
          published_at: string | null;
          journal: string | null;
          source_tier: number | null;
          identity_status: SourceIdentityStatus | null;
          doi_status: DoiStatus | null;
          retraction_status: RetractionStatus | null;
          is_accessible: boolean;
          fetch_error: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          source_type: "doi" | "url" | "upload";
          raw_identifier: string;
          normalized_identifier?: string | null;
          title?: string | null;
          authors?: string[] | null;
          published_at?: string | null;
          journal?: string | null;
          source_tier?: number | null;
          identity_status?: SourceIdentityStatus | null;
          doi_status?: DoiStatus | null;
          retraction_status?: RetractionStatus | null;
          is_accessible?: boolean;
          fetch_error?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          organization_id?: string;
          source_type?: "doi" | "url" | "upload";
          raw_identifier?: string;
          normalized_identifier?: string | null;
          title?: string | null;
          authors?: string[] | null;
          published_at?: string | null;
          journal?: string | null;
          source_tier?: number | null;
          identity_status?: SourceIdentityStatus | null;
          doi_status?: DoiStatus | null;
          retraction_status?: RetractionStatus | null;
          is_accessible?: boolean;
          fetch_error?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      evidence_matches: {
        Row: {
          id: string;
          case_id: string;
          claim_id: string;
          source_id: string;
          organization_id: string;
          relationship: EvidenceRelationship;
          entailment_score: number | null;
          passage_text: string | null;
          passage_locator: Json | null;
          reasoning: Json | null;
          match_model: string | null;
          prompt_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          claim_id: string;
          source_id: string;
          organization_id: string;
          relationship: EvidenceRelationship;
          entailment_score?: number | null;
          passage_text?: string | null;
          passage_locator?: Json | null;
          reasoning?: Json | null;
          match_model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          claim_id?: string;
          source_id?: string;
          organization_id?: string;
          relationship?: EvidenceRelationship;
          entailment_score?: number | null;
          passage_text?: string | null;
          passage_locator?: Json | null;
          reasoning?: Json | null;
          match_model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      prosecutor_reviews: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          objections: Json;
          recommendation: string;
          single_provider_warning: boolean;
          reasoning: string | null;
          model: string | null;
          prompt_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          objections?: Json;
          recommendation: string;
          single_provider_warning?: boolean;
          reasoning?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          organization_id?: string;
          objections?: Json;
          recommendation?: string;
          single_provider_warning?: boolean;
          reasoning?: string | null;
          model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      scoring_results: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          score_version: string;
          components: Json;
          policy_overrides: Json;
          verdict: PublicVerdict;
          explanation: Json;
          stakes_level: StakesLevel | null;
          materiality: Materiality | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          score_version: string;
          components: Json;
          policy_overrides?: Json;
          verdict: PublicVerdict;
          explanation: Json;
          stakes_level?: StakesLevel | null;
          materiality?: Materiality | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          organization_id?: string;
          score_version?: string;
          components?: Json;
          policy_overrides?: Json;
          verdict?: PublicVerdict;
          explanation?: Json;
          stakes_level?: StakesLevel | null;
          materiality?: Materiality | null;
          created_at?: string;
        };
        Relationships: [];
      };
      verification_reports: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          report_type: string;
          content: Json;
          apa_references: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          report_type?: string;
          content: Json;
          apa_references?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          organization_id?: string;
          report_type?: string;
          content?: Json;
          apa_references?: string[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      verification_jobs: {
        Row: {
          id: string;
          case_id: string;
          job_type: string;
          status: JobStatus;
          payload: Json;
          result: Json | null;
          attempts: number;
          max_attempts: number;
          error_message: string | null;
          run_after: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          job_type?: string;
          status?: JobStatus;
          payload?: Json;
          result?: Json | null;
          attempts?: number;
          max_attempts?: number;
          error_message?: string | null;
          run_after?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          job_type?: string;
          status?: JobStatus;
          payload?: Json;
          result?: Json | null;
          attempts?: number;
          max_attempts?: number;
          error_message?: string | null;
          run_after?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          case_id: string | null;
          event_type: string;
          event_data: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          case_id?: string | null;
          event_type: string;
          event_data?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      commitments: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          title: string;
          description: string | null;
          commitment_text: string;
          source_url: string | null;
          committed_at: string | null;
          committer_name: string | null;
          committer_role: string | null;
          status: CommitmentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          commitment_text: string;
          source_url?: string | null;
          committed_at?: string | null;
          committer_name?: string | null;
          committer_role?: string | null;
          status?: CommitmentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          commitment_text?: string;
          source_url?: string | null;
          committed_at?: string | null;
          committer_name?: string | null;
          committer_role?: string | null;
          status?: CommitmentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      commitment_evaluations: {
        Row: {
          id: string;
          commitment_id: string;
          organization_id: string;
          evaluated_by: string;
          evidence_text: string;
          verdict: CommitmentVerdict;
          reasoning: string;
          model: string | null;
          prompt_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          commitment_id: string;
          organization_id: string;
          evaluated_by: string;
          evidence_text: string;
          verdict: CommitmentVerdict;
          reasoning: string;
          model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          commitment_id?: string;
          organization_id?: string;
          evaluated_by?: string;
          evidence_text?: string;
          verdict?: CommitmentVerdict;
          reasoning?: string;
          model?: string | null;
          prompt_version?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      benchmark_runs: {
        Row: {
          id: string;
          run_by: string | null;
          score_version: string;
          total_fixtures: number;
          passed: number;
          failed: number;
          gate_results: Json;
          all_gates_pass: boolean;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_by?: string | null;
          score_version: string;
          total_fixtures: number;
          passed: number;
          failed: number;
          gate_results?: Json;
          all_gates_pass?: boolean;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_by?: string | null;
          score_version?: string;
          total_fixtures?: number;
          passed?: number;
          failed?: number;
          gate_results?: Json;
          all_gates_pass?: boolean;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
