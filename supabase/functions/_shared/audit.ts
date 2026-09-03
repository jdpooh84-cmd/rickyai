/**
 * Shared audit-log helper for Supabase Edge Functions.
 * Uses the service-role client to write immutable audit_logs records.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

export interface AuditEntry {
  businessId?: string | null;
  actorId?: string | null;
  actorType?: "user" | "system" | "edge_function" | "webhook";
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Writes one audit log entry. Failures are logged but never throw —
 * audit failures must not abort the primary operation.
 */
export async function emitAudit(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      business_id: entry.businessId ?? null,
      actor_id: entry.actorId ?? null,
      actor_type: entry.actorType ?? "edge_function",
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ipAddress ?? null,
    });
  } catch (err) {
    // Never propagate audit failures
    console.error("[audit] failed to write audit log:", err);
  }
}
