import { NextResponse } from "next/server";
import { pollAndProcessJobs } from "@/lib/jobs/worker";
import { safeLog } from "@/lib/security/sanitizer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env["CRON_SECRET"];

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
