// migrate-plaintext-keys — one-time admin-callable function that re-encrypts
// any user_api_keys rows where key_version = 'v0-plaintext'.
//
// Protection: requires MIGRATE_KEYS_SECRET header matching a server-side secret.
// Never exposed to browsers. Run once after confirming USER_API_KEY_ENCRYPTION_SECRET
// is set in Supabase secrets.
//
// verify_jwt = false (intentionally — uses own secret gate, not user JWT)
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encrypt, maskKey } from "../_shared/credential-service.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Gate: must present the MIGRATE_KEYS_SECRET header
  const migrateSecret = Deno.env.get("MIGRATE_KEYS_SECRET");
  if (!migrateSecret) {
    console.error("[migrate-plaintext-keys] MIGRATE_KEYS_SECRET not configured — refusing all requests");
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const presented = req.headers.get("x-migrate-secret") ?? "";
  // Constant-time comparison
  const a = new TextEncoder().encode(migrateSecret.padEnd(64));
  const b = new TextEncoder().encode(presented.padEnd(64));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0 || presented.length !== migrateSecret.length) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch all plaintext rows — service role bypasses column-level revoke
  const { data: rows, error: fetchErr } = await supabase
    .from("user_api_keys")
    .select("id, api_key_encrypted")
    .eq("key_version", "v0-plaintext");

  if (fetchErr) {
    console.error("[migrate-plaintext-keys] Fetch error:", fetchErr.message);
    return new Response(JSON.stringify({ error: "DB fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, migrated: 0, message: "No plaintext rows found" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let migrated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const plaintext: string = row.api_key_encrypted;
      if (!plaintext || plaintext.length < 4) {
        errors.push(`row ${row.id}: value too short to re-encrypt`);
        failed++;
        continue;
      }

      const { ciphertext, iv } = await encrypt(plaintext);
      const masked = maskKey(plaintext);

      const { error: updateErr } = await supabase
        .from("user_api_keys")
        .update({
          api_key_encrypted: ciphertext,
          key_iv: iv,
          key_version: "v1-aes256gcm",
          api_key_masked: masked,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("key_version", "v0-plaintext"); // optimistic check — only update if still plaintext

      if (updateErr) {
        errors.push(`row ${row.id}: ${updateErr.message}`);
        failed++;
      } else {
        migrated++;
        console.log(`[migrate-plaintext-keys] Migrated row ${row.id}`);
      }
    } catch (encErr: any) {
      errors.push(`row ${row.id}: ${encErr?.message ?? String(encErr)}`);
      failed++;
    }
  }

  const result = { ok: failed === 0, migrated, failed, errors };
  console.log("[migrate-plaintext-keys] Done:", JSON.stringify({ migrated, failed }));

  return new Response(JSON.stringify(result), {
    status: failed > 0 ? 207 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
