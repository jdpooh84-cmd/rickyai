-- B-02: Idempotency store for webhook callbacks.
--
-- Prevents duplicate state changes from replayed Creatomate / Klap callbacks.
-- The primary key (provider, event_fingerprint) makes a second insert for
-- the same event a no-op via ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS webhook_receipts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         text        NOT NULL,
  event_fingerprint text       NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT now(),
  payload_summary  text
);

-- Enforce uniqueness per (provider, fingerprint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_receipts_provider_fingerprint_key'
  ) THEN
    ALTER TABLE webhook_receipts
      ADD CONSTRAINT webhook_receipts_provider_fingerprint_key
      UNIQUE (provider, event_fingerprint);
  END IF;
END $$;

-- Purge receipts older than 30 days (safe to run on a schedule).
-- Call manually: SELECT purge_old_webhook_receipts();
CREATE OR REPLACE FUNCTION purge_old_webhook_receipts()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM webhook_receipts WHERE received_at < now() - interval '30 days';
$$;

-- service_role only — callbacks run as service_role.
REVOKE ALL ON TABLE webhook_receipts FROM PUBLIC;
GRANT ALL ON TABLE webhook_receipts TO service_role;

REVOKE ALL ON FUNCTION purge_old_webhook_receipts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_old_webhook_receipts() TO service_role;
