-- Extend evidence_matches relationship CHECK constraint to include
-- "irrelevant" and "cannot_verify" values used by the LLM matching schema.
-- PostgreSQL does not support ALTER ... MODIFY CONSTRAINT, so we drop and recreate.

alter table public.evidence_matches
  drop constraint if exists evidence_matches_relationship_check;

alter table public.evidence_matches
  add constraint evidence_matches_relationship_check
    check (relationship in (
      'supports',
      'partially_supports',
      'contradicts',
      'context_only',
      'not_relevant',
      'irrelevant',
      'cannot_verify'
    ));
