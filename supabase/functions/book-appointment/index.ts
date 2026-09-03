import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  requireUuid,
  requireString,
  requireOneOf,
  optionalString,
  validate,
  ValidationError,
} from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ─── date helpers ────────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" safely as UTC midnight. */
function parseUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Convert a Postgres `time` string "HH:MM:SS" to minutes-since-midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Add `minutes` to a Date and return a new Date. */
function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

// ─── conflict helpers ─────────────────────────────────────────────────────────

/** True if [aStart, aEnd) overlaps [bStart, bEnd). */
function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// ─── actions ──────────────────────────────────────────────────────────────────

async function getAvailability(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const validated = validate(() => ({
    businessId: requireUuid(body.businessId, "businessId"),
    appointmentTypeId: requireUuid(body.appointmentTypeId, "appointmentTypeId"),
    date: requireString(body.date as unknown, "date", 10),
  }));
  if (validated instanceof Response) return validated;
  const { businessId, appointmentTypeId, date } = validated;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return err("date must be YYYY-MM-DD");
  }

  const dayStart = parseUTCDate(date);
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const dayOfWeek = dayStart.getUTCDay(); // 0=Sun

  // Load appointment type
  const { data: apptType, error: typeErr } = await supabase
    .from("appointment_types")
    .select("id, duration_minutes, buffer_minutes")
    .eq("id", appointmentTypeId)
    .eq("active", true)
    .maybeSingle();
  if (typeErr || !apptType) return err("Appointment type not found", 404);

  const duration = apptType.duration_minutes as number;
  const buffer = (apptType.buffer_minutes as number) ?? 0;

  // Load availability rules for this day
  const { data: rules } = await supabase
    .from("availability_rules")
    .select("start_time, end_time")
    .eq("business_id", businessId)
    .eq("day_of_week", dayOfWeek)
    .eq("active", true);

  if (!rules || rules.length === 0) {
    return json({ slots: [] });
  }

  // Load existing appointments that day (non-cancelled, non-no_show)
  const { data: existingAppts } = await supabase
    .from("appointments")
    .select("start_at, end_at")
    .eq("business_id", businessId)
    .gte("start_at", dayStart.toISOString())
    .lt("start_at", dayEnd.toISOString())
    .not("status", "in", '("cancelled","no_show")');

  // Load active holds that day (not expired)
  const { data: existingHolds } = await supabase
    .from("appointment_holds")
    .select("start_at, end_at")
    .eq("business_id", businessId)
    .gte("start_at", dayStart.toISOString())
    .lt("start_at", dayEnd.toISOString())
    .gt("expires_at", new Date().toISOString())
    .eq("converted", false);

  const busyBlocks: Array<{ start: Date; end: Date }> = [
    ...(existingAppts ?? []).map((a: { start_at: string; end_at: string }) => ({
      start: new Date(a.start_at),
      end: new Date(a.end_at),
    })),
    ...(existingHolds ?? []).map((h: { start_at: string; end_at: string }) => ({
      start: new Date(h.start_at),
      end: new Date(h.end_at),
    })),
  ];

  const slots: Array<{ start: string; end: string; available: boolean }> = [];

  for (const rule of rules) {
    const windowStart = timeToMinutes(rule.start_time as string);
    const windowEnd = timeToMinutes(rule.end_time as string);

    let cursor = windowStart;
    while (cursor + duration <= windowEnd) {
      const slotStart = addMinutes(dayStart, cursor);
      const slotEnd = addMinutes(slotStart, duration);
      // effectiveEnd includes buffer for conflict detection
      const effectiveEnd = addMinutes(slotEnd, buffer);

      const available = !busyBlocks.some((b) =>
        overlaps(slotStart, effectiveEnd, b.start, b.end)
      );

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available,
      });

      cursor += 30; // every 30 minutes
    }
  }

  return json({ slots });
}

async function holdSlot(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const validated = validate(() => ({
    businessId: requireUuid(body.businessId, "businessId"),
    appointmentTypeId: requireUuid(body.appointmentTypeId, "appointmentTypeId"),
    start: requireString(body.start as unknown, "start", 50),
  }));
  if (validated instanceof Response) return validated;
  const { businessId, appointmentTypeId, start } = validated;

  const contactId = body.contactId
    ? (() => {
      try {
        return requireUuid(body.contactId, "contactId");
      } catch {
        return null;
      }
    })()
    : null;

  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) return err("start must be a valid ISO8601 datetime");

  // Load appointment type
  const { data: apptType, error: typeErr } = await supabase
    .from("appointment_types")
    .select("duration_minutes, buffer_minutes")
    .eq("id", appointmentTypeId)
    .eq("active", true)
    .maybeSingle();
  if (typeErr || !apptType) return err("Appointment type not found", 404);

  const duration = apptType.duration_minutes as number;
  const buffer = (apptType.buffer_minutes as number) ?? 0;
  const endDate = addMinutes(startDate, duration);
  const effectiveEnd = addMinutes(endDate, buffer);

  // Conflict check — existing appointments
  const { data: conflictAppts } = await supabase
    .from("appointments")
    .select("id, start_at, end_at")
    .eq("business_id", businessId)
    .not("status", "in", '("cancelled","no_show")')
    .lt("start_at", effectiveEnd.toISOString())
    .gt("end_at", startDate.toISOString());

  if (conflictAppts && conflictAppts.length > 0) {
    return json({ held: false, reason: "slot_taken" }, 409);
  }

  // Conflict check — active holds
  const { data: conflictHolds } = await supabase
    .from("appointment_holds")
    .select("id, start_at, end_at")
    .eq("business_id", businessId)
    .eq("converted", false)
    .gt("expires_at", new Date().toISOString())
    .lt("start_at", effectiveEnd.toISOString())
    .gt("end_at", startDate.toISOString());

  if (conflictHolds && conflictHolds.length > 0) {
    return json({ held: false, reason: "slot_taken" }, 409);
  }

  const expiresAt = addMinutes(new Date(), 10);

  const { data: hold, error: holdErr } = await supabase
    .from("appointment_holds")
    .insert({
      business_id: businessId,
      appointment_type_id: appointmentTypeId,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      expires_at: expiresAt.toISOString(),
      converted: false,
      contact_id: contactId ?? null,
    })
    .select("id, expires_at")
    .single();

  if (holdErr || !hold) {
    console.error("hold insert error:", holdErr?.message);
    return err("Failed to create hold", 500);
  }

  return json({
    held: true,
    holdId: hold.id,
    expiresAt: hold.expires_at,
  });
}

async function confirmBooking(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const validated = validate(() => ({
    businessId: requireUuid(body.businessId, "businessId"),
    holdId: requireUuid(body.holdId, "holdId"),
    contactId: requireUuid(body.contactId, "contactId"),
  }));
  if (validated instanceof Response) return validated;
  const { businessId, holdId, contactId } = validated;

  const notes = optionalString(body.notes, "notes", 2000);
  const staffName = optionalString(body.staffName, "staffName", 200);

  // Load hold
  const { data: hold, error: holdErr } = await supabase
    .from("appointment_holds")
    .select("id, start_at, end_at, expires_at, converted, appointment_type_id, business_id")
    .eq("id", holdId)
    .maybeSingle();

  if (holdErr || !hold) return err("Hold not found", 404);
  if (hold.business_id !== businessId) return err("Forbidden", 403);
  if (hold.converted) return json({ booked: false, reason: "already_booked" });
  if (new Date(hold.expires_at) <= new Date()) {
    return json({ booked: false, reason: "hold_expired" });
  }

  // Insert appointment
  const { data: appt, error: apptErr } = await supabase
    .from("appointments")
    .insert({
      business_id: businessId,
      appointment_type_id: hold.appointment_type_id,
      contact_id: contactId,
      start_at: hold.start_at,
      end_at: hold.end_at,
      status: "requested",
      notes: notes ?? null,
      staff_name: staffName ?? null,
    })
    .select("id")
    .single();

  if (apptErr || !appt) {
    console.error("appointment insert error:", apptErr?.message);
    return err("Failed to create appointment", 500);
  }

  // Mark hold converted
  await supabase
    .from("appointment_holds")
    .update({ converted: true })
    .eq("id", holdId);

  console.log("appointment created:", appt.id, "business:", businessId);

  return json({ booked: true, appointmentId: appt.id });
}

async function cancelAppointment(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const validated = validate(() => ({
    businessId: requireUuid(body.businessId, "businessId"),
    appointmentId: requireUuid(body.appointmentId, "appointmentId"),
  }));
  if (validated instanceof Response) return validated;
  const { businessId, appointmentId } = validated;

  const reason = optionalString(body.reason, "reason", 500);

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, business_id, status")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appt) return err("Appointment not found", 404);
  if (appt.business_id !== businessId) return err("Forbidden", 403);
  if (appt.status === "cancelled") return json({ cancelled: true });

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      notes: reason
        ? `Cancelled: ${reason}`
        : undefined,
    })
    .eq("id", appointmentId);

  if (updateErr) {
    console.error("cancel error:", updateErr.message);
    return err("Failed to cancel appointment", 500);
  }

  console.log("appointment cancelled:", appointmentId, "business:", businessId);

  return json({ cancelled: true });
}

async function getAppointments(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const validated = validate(() => ({
    businessId: requireUuid(body.businessId, "businessId"),
  }));
  if (validated instanceof Response) return validated;
  const { businessId } = validated;

  let query = supabase
    .from("appointments")
    .select(
      "id, start_at, end_at, status, notes, staff_name, contacts(first_name, last_name, phone, email), appointment_types(name, duration_minutes)",
    )
    .eq("business_id", businessId)
    .order("start_at", { ascending: false })
    .limit(100);

  if (body.from && typeof body.from === "string") {
    query = query.gte("start_at", body.from);
  }
  if (body.to && typeof body.to === "string") {
    query = query.lte("start_at", body.to);
  }
  if (body.status && typeof body.status === "string") {
    query = query.eq("status", body.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getAppointments error:", error.message);
    return err("Failed to fetch appointments", 500);
  }

  return json({ appointments: data ?? [] });
}

// ─── main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client for auth verification
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return err("Unauthorized", 401);

    // Service client for data operations
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json() as Record<string, unknown>;

    const actionRaw = body.action;
    const allowedActions = [
      "get_availability",
      "hold_slot",
      "confirm_booking",
      "cancel_appointment",
      "get_appointments",
    ] as const;

    const actionResult = validate(() =>
      requireOneOf(actionRaw, "action", allowedActions)
    );
    if (actionResult instanceof Response) return actionResult;
    const action = actionResult as typeof allowedActions[number];

    // Verify business ownership for all actions
    const businessId = body.businessId;
    if (!businessId || typeof businessId !== "string") {
      return err("businessId is required", 400);
    }

    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!biz) return err("Business not found or access denied", 403);

    // Dispatch
    switch (action) {
      case "get_availability":
        return getAvailability(supabase, body);
      case "hold_slot":
        return holdSlot(supabase, body);
      case "confirm_booking":
        return confirmBooking(supabase, body);
      case "cancel_appointment":
        return cancelAppointment(supabase, body);
      case "get_appointments":
        return getAppointments(supabase, body);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("book-appointment unhandled:", msg);
    return err("Internal server error", 500);
  }
});
