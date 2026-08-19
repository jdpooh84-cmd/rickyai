-- Atomic render usage check-and-increment.
-- Replaces the non-atomic select-then-update pattern in webhook-proxy (C-01).
-- The function acquires a row-level lock, checks the quota, and increments in a
-- single transaction — eliminating the race condition under concurrent callbacks.

-- Ensure (user_id, period_start) is unique so ON CONFLICT works correctly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_tracking_user_id_period_start_key'
  ) THEN
    ALTER TABLE usage_tracking
      ADD CONSTRAINT usage_tracking_user_id_period_start_key
      UNIQUE (user_id, period_start);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION check_and_increment_render_usage(
  p_user_id    uuid,
  p_period_start timestamptz,
  p_period_end   timestamptz,
  p_limit      int DEFAULT 50
)
RETURNS TABLE(allowed boolean, render_jobs_used int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current int;
  v_new     int;
BEGIN
  -- Pessimistic lock on the row for this user+period.
  SELECT COALESCE(t.render_jobs_used, 0) INTO v_current
  FROM usage_tracking t
  WHERE t.user_id = p_user_id AND t.period_start = p_period_start
  FOR UPDATE;

  v_current := COALESCE(v_current, 0);

  IF v_current >= p_limit THEN
    RETURN QUERY SELECT false, v_current;
    RETURN;
  END IF;

  -- Atomic upsert with increment.
  INSERT INTO usage_tracking (user_id, period_start, period_end, render_jobs_used, updated_at)
  VALUES (p_user_id, p_period_start, p_period_end, 1, now())
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    render_jobs_used = usage_tracking.render_jobs_used + 1,
    updated_at       = now()
  RETURNING usage_tracking.render_jobs_used INTO v_new;

  RETURN QUERY SELECT true, v_new;
END;
$$;

REVOKE ALL ON FUNCTION check_and_increment_render_usage(uuid, timestamptz, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_and_increment_render_usage(uuid, timestamptz, timestamptz, int) TO service_role;
