-- B-01: API key encryption schema additions.
--
-- Adds key_iv, key_version, and api_key_masked columns to user_api_keys.
-- Restricts column-level SELECT on api_key_encrypted and key_iv so that
-- browser-scoped anon/authenticated clients cannot retrieve ciphertext.
-- Only service_role (edge functions) can decrypt credentials.
--
-- Existing rows retain their plaintext value in api_key_encrypted but are
-- tagged key_version = 'v0-plaintext' so decryption paths can handle both
-- until re-enrollment is complete.

-- Step 1: Add new columns (all nullable so existing rows are unaffected).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_api_keys' AND column_name = 'key_iv'
  ) THEN
    ALTER TABLE user_api_keys ADD COLUMN key_iv text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_api_keys' AND column_name = 'key_version'
  ) THEN
    ALTER TABLE user_api_keys ADD COLUMN key_version text NOT NULL DEFAULT 'v0-plaintext';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_api_keys' AND column_name = 'api_key_masked'
  ) THEN
    ALTER TABLE user_api_keys ADD COLUMN api_key_masked text;
  END IF;
END $$;

-- Step 2: Tag all existing rows as plaintext so migration state is explicit.
UPDATE user_api_keys
SET key_version = 'v0-plaintext'
WHERE key_version IS NULL OR key_version = '';

-- Step 3: Revoke column-level SELECT on sensitive columns from authenticated
-- and anon roles.  The existing RLS policy allows row-level access to own
-- rows, but column-level REVOKE is enforced before RLS evaluation, so
-- browser clients cannot retrieve ciphertext even for their own rows.
-- service_role bypasses both column grants and RLS, so edge functions are
-- unaffected.
REVOKE SELECT (api_key_encrypted, key_iv) ON user_api_keys FROM authenticated;
REVOKE SELECT (api_key_encrypted, key_iv) ON user_api_keys FROM anon;

-- Step 4: Re-grant SELECT on the safe columns only.
GRANT SELECT (id, user_id, provider, key_version, api_key_masked, is_valid, created_at, updated_at)
  ON user_api_keys TO authenticated;

-- Step 5: Revoke INSERT/UPDATE on the ciphertext columns from the browser
-- roles so clients cannot write plaintext directly.
REVOKE INSERT (api_key_encrypted, key_iv, key_version) ON user_api_keys FROM authenticated;
REVOKE UPDATE (api_key_encrypted, key_iv, key_version) ON user_api_keys FROM authenticated;
