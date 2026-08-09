import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { pollAndProcessJobs } from "@/lib/jobs/worker";
import { safeLog } from "@/lib/security/sanitizer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifySecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // timingSafeEqual requires same-length buffers
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env["CRON_SECRET"];

  // Fail closed: if no CRON_SECRET is configured, reject all requests.
  // Vercel always provides the secret header when the cron is registered.
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!verifySecret(provided, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await pollAndProcessJobs();
    return NextResponse.json({ ok: true });
  } catch (err) {
    safeLog("error", "Cron job processing failed", { error: err });
    return NextResponse.json({ error: "Job processing failed" }, { status: 500 });
  }
}
