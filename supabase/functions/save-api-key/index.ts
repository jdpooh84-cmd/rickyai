import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encrypt, maskKey } from "../_shared/credential-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_PROVIDERS = new Set([
  "creatomate",
  "klap",
  "elevenlabs",
  "heygen",
  "invideo",
  "gemini",
  "make",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const provider: string = (body.provider ?? "").toLowerCase().trim();
    const rawKey: string = (body.api_key ?? "").trim();

    if (!ALLOWED_PROVIDERS.has(provider)) {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!rawKey || rawKey.length < 8) {
      return new Response(
        JSON.stringify({ error: "api_key must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { ciphertext, iv } = await encrypt(rawKey);
    const masked = maskKey(rawKey);

    const { error: upsertError } = await supabase
      .from("user_api_keys")
      .upsert(
        {
          user_id: user.id,
          provider,
          api_key_encrypted: ciphertext,
          key_iv: iv,
          key_version: "v1-aes256gcm",
          api_key_masked: masked,
          is_valid: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );

    if (upsertError) {
      console.error("save-api-key upsert error:", upsertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to save key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, provider, masked }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("save-api-key error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
