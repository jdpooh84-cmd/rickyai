# Database

## Design Principles

- UUID primary keys throughout.
- All organization-owned records include `organization_id` directly or via enforced parent join.
- `updated_at` is maintained by trigger, not application code.
- Row Level Security is enabled on all user-facing tables.
- Check constraints enforce enum values at the database level.
- Migrations are in `supabase/migrations/` and numbered sequentially.

## Tables

### organizations
Tenant root. All data isolation flows from this table.

### profiles
One per `auth.users` row, linked to an organization. Role controls admin access.

### verification_cases
Central record for each verification request. Tracks status through the pipeline state machine. `final_verdict` is set only when `status = 'completed'`.

### case_artifacts
Stores metadata about uploaded files and fetched URLs. Extracted text is stored here after parsing. Original files are in Supabase Storage at `storage_path`.

### verification_jobs
Job queue table. Worker polls for `status = 'queued'` rows. Locking via `locked_at` timestamp prevents double-processing. Max 5 attempts before marking `failed`.

### claims
Individual factual assertions extracted from the case. Each claim is processed independently through the pipeline.

### sources
Canonical source registry. `canonical_url` or `normalized_doi` is the deduplication key. Source identity and retraction status are tracked here.

### source_passages
Exact text passages extracted from a source, with locator metadata (page, heading, paragraph).

### claim_evidence
Links a claim to a specific passage with an entailment relationship: supports, partially_supports, contradicts, context_only, irrelevant, cannot_verify.

### verification_runs
Audit log of every AI model invocation. Records provider, model, prompt version, input hash, output, status, latency, and estimated cost.

### claim_scores
Full scoring breakdown for each claim: all component scores, penalties, policy overrides applied, final verdict, and plain-language explanation.

### commitments
Stored commitments/promises/policies with subject, scope, and source linkage.

### commitment_evaluations
Comparison result of a commitment against later evidence. Verdict is one of: CONSISTENT, PARTIALLY_CONSISTENT, CONTRADICTED, NOT_EVALUABLE.

### benchmark_cases
Controlled test cases with known ground truth for release gate validation.

### benchmark_results
Results of running a benchmark case through the pipeline. Tracks pass/fail, failure types, provider, and pipeline version.

### audit_events
Immutable event log. Records case creation, access, source retrieval, model runs, score events, exports, and administrative actions.

## Enum Values

```sql
-- verification_cases.status
'queued' | 'processing' | 'completed' | 'failed'

-- claims.materiality
'low' | 'medium' | 'high'

-- stakes_level (claims, verification_cases)
'low' | 'medium' | 'high'

-- claim_evidence.relationship
'supports' | 'partially_supports' | 'contradicts' | 'context_only' | 'irrelevant' | 'cannot_verify'

-- sources.identity_status
'unverified' | 'verified' | 'metadata_only' | 'mismatched' | 'failed'

-- sources.retraction_status
'unknown' | 'current' | 'corrected' | 'retracted'

-- verification_jobs.status
'queued' | 'running' | 'retrying' | 'completed' | 'failed'
```

## RLS Policy Summary

Every user-facing table has a policy that allows access only when `organization_id` matches the authenticated user's organization. The service role bypasses RLS and is used only server-side for background jobs.

SQL tests in `supabase/tests/` prove cross-organization isolation for every table.
