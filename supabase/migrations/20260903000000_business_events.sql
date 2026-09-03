-- MILESTONE 1: Business Event Engine
-- Unified event store for the Ricky closed-loop growth system.
-- Every meaningful thing that happens in a business's lifecycle is recorded here.
-- Events flow into lifecycle evaluation, analytics, attribution, and Growth Lab.

CREATE TABLE IF NOT EXISTS business_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id      uuid        REFERENCES locations(id) ON DELETE SET NULL,
  contact_id       uuid,       -- references contacts(id) when that table exists
  lead_id          uuid,       -- references leads(id) when that table exists
  appointment_id   uuid,       -- references appointments(id) when that table exists
  campaign_id      uuid,       -- references campaign in relevant table
  experiment_id    uuid,       -- references growth_experiments(id) when that table exists
  type             text        NOT NULL,
  source           text        NOT NULL DEFAULT 'ricky',
  payload          jsonb       NOT NULL DEFAULT '{}',
  idempotency_key  text,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Tenant isolation — every query must scope to business_id
CREATE INDEX IF NOT EXISTS business_events_business_id_idx
  ON business_events (business_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS business_events_type_idx
  ON business_events (business_id, type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS business_events_contact_idx
  ON business_events (contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_events_lead_idx
  ON business_events (lead_id)
  WHERE lead_id IS NOT NULL;

-- Idempotency: one event per (business, key)
CREATE UNIQUE INDEX IF NOT EXISTS business_events_idempotency_key_idx
  ON business_events (business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- RLS
ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;

-- Owner and team can read their own business events
CREATE POLICY "business_events_owner_read" ON business_events
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Service-role (edge functions) can do everything
-- Edge functions use service_role which bypasses RLS — no explicit policy needed

COMMENT ON TABLE business_events IS
  'Unified event store for the Ricky closed-loop growth system. '
  'Immutable append-only log — never update or delete rows. '
  'Events drive lifecycle evaluation, attribution, analytics, and Growth Lab.';
