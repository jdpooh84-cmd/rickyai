-- MILESTONE 1: Durable Agent Job System
-- Persistent queue for all background work Ricky performs on behalf of a business.
-- Covers: AI generation, external API calls, Creatomate renders, scheduling,
-- follow-up sends, campaign dispatch, reconciliation, and more.

CREATE TYPE IF NOT EXISTS agent_job_status AS ENUM (
  'queued',
  'running',
  'waiting_external',
  'completed',
  'retryable',
  'failed',
  'cancelled'
);

CREATE TABLE IF NOT EXISTS agent_jobs (
  id                uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid              NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id       uuid              REFERENCES locations(id) ON DELETE SET NULL,
  job_type          text              NOT NULL,
  status            agent_job_status  NOT NULL DEFAULT 'queued',
  priority          int               NOT NULL DEFAULT 5,  -- 1=highest, 10=lowest
  input_json        jsonb             NOT NULL DEFAULT '{}',
  output_json       jsonb,
  provider          text,             -- e.g. 'creatomate', 'twilio', 'openai'
  provider_job_id   text,             -- external reference (render ID, message SID, etc.)
  attempt_count     int               NOT NULL DEFAULT 0,
  max_attempts      int               NOT NULL DEFAULT 3,
  next_attempt_at   timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  last_error        text,
  idempotency_key   text,
  created_at        timestamptz       NOT NULL DEFAULT now(),
  updated_at        timestamptz       NOT NULL DEFAULT now()
);

-- Index for queue workers claiming next available job
CREATE INDEX IF NOT EXISTS agent_jobs_queue_idx
  ON agent_jobs (status, priority, next_attempt_at)
  WHERE status IN ('queued', 'retryable');

-- Index for reconciliation: find stale waiting_external jobs
CREATE INDEX IF NOT EXISTS agent_jobs_stale_idx
  ON agent_jobs (status, provider, updated_at)
  WHERE status = 'waiting_external';

-- Tenant isolation
CREATE INDEX IF NOT EXISTS agent_jobs_business_idx
  ON agent_jobs (business_id, status, created_at DESC);

-- Provider job lookup (e.g. find job by Creatomate render ID)
CREATE INDEX IF NOT EXISTS agent_jobs_provider_job_idx
  ON agent_jobs (provider, provider_job_id)
  WHERE provider_job_id IS NOT NULL;

-- Idempotency: one job per key per business
CREATE UNIQUE INDEX IF NOT EXISTS agent_jobs_idempotency_idx
  ON agent_jobs (business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- RLS
ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;

-- Owner/team can read their own business jobs
CREATE POLICY "agent_jobs_owner_read" ON agent_jobs
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION touch_agent_job_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_jobs_updated_at ON agent_jobs;
CREATE TRIGGER agent_jobs_updated_at
  BEFORE UPDATE ON agent_jobs
  FOR EACH ROW EXECUTE FUNCTION touch_agent_job_updated_at();

COMMENT ON TABLE agent_jobs IS
  'Durable job queue for all background work in the Ricky system. '
  'Each job tracks its lifecycle from queued → running → completed/failed. '
  'External operations (Creatomate, Twilio, etc.) use waiting_external until callback. '
  'Reconciliation sweeps find stale waiting_external jobs and repair state.';
