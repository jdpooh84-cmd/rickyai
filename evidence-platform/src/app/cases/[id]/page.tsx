import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PageParams = { params: Promise<{ id: string }> };

export default async function CaseDetailPage({ params }: PageParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: verificationCase } = await supabase
    .from("verification_cases")
    .select("*")
    .eq("id", id)
    .single();

  if (!verificationCase) notFound();

  const [claimsResult, sourcesResult, scoringResult, reportResult] = await Promise.all([
    supabase.from("extracted_claims").select("*").eq("case_id", id).order("created_at"),
    supabase.from("evidence_sources").select("*").eq("case_id", id).order("source_tier"),
    supabase
      .from("scoring_results")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("verification_reports")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const claims = claimsResult.data ?? [];
  const sources = sourcesResult.data ?? [];
  const scoring = scoringResult.data;
  const report = reportResult.data;

  const isProcessing = ["queued", "processing"].includes(verificationCase.status);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <Link href="/cases" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← All cases
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50 break-words">
            {verificationCase.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {verificationCase.input_type} · submitted{" "}
            {new Date(verificationCase.created_at).toLocaleDateString()}
            {verificationCase.domain && ` · domain: ${verificationCase.domain}`}
          </p>
        </div>
        <div className="ml-4 shrink-0">
          <StatusBadge status={verificationCase.status} />
        </div>
      </div>

      {isProcessing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <span className="font-semibold">Processing</span>{" "}
          {verificationCase.pipeline_stage
            ? `— stage: ${verificationCase.pipeline_stage}`
            : "— queued for processing"}
          <br />
          <span className="text-xs opacity-70">Refresh the page to see updated status.</span>
        </div>
      )}

      {verificationCase.status === "failed" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <span className="font-semibold">Pipeline failed</span>
          {verificationCase.error_message && (
            <span className="ml-1">— {verificationCase.error_message}</span>
          )}
          <div className="mt-2">
            <RerunButton caseId={id} />
          </div>
        </div>
      )}

      {verificationCase.public_verdict && scoring && (
        <VerdictCard
          verdict={verificationCase.public_verdict}
          score={verificationCase.score ?? 0}
          explanation={scoring.explanation as { summary: string; score_narrative: string; limitations: string[] }}
          overrides={(scoring.policy_overrides as Array<{ rule: string; applied: boolean; reason: string }>) ?? []}
        />
      )}

      {report && (
        <section className="rounded-xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Report summary</h2>
          <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p><span className="font-medium">Claims extracted:</span> {(report.content as { claims_count?: number }).claims_count ?? "—"}</p>
            <p><span className="font-medium">Sources found:</span> {(report.content as { sources_count?: number }).sources_count ?? "—"}</p>
            {((report.content as { limitations?: string[] }).limitations ?? []).length > 0 && (
              <div>
                <p className="font-medium">Limitations:</p>
                <ul className="mt-1 ml-4 list-disc space-y-1 text-zinc-500 dark:text-zinc-400">
                  {((report.content as { limitations?: string[] }).limitations ?? []).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {claims.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
            Extracted claims ({claims.length})
          </h2>
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {claims.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">{c.claim_text}</p>
                <div className="mt-1 flex gap-2">
                  <span className="text-xs text-zinc-500">{c.claim_type}</span>
                  {!c.is_verifiable && (
                    <span className="text-xs text-zinc-400 italic">not verifiable</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
            Evidence sources ({sources.length})
          </h2>
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {sources.map((s) => (
              <div key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {s.title ?? s.raw_identifier}
                    </p>
                    {s.title && (
                      <p className="text-xs text-zinc-500 font-mono truncate">{s.raw_identifier}</p>
                    )}
                    {s.authors && s.authors.length > 0 && (
                      <p className="text-xs text-zinc-500">{s.authors.slice(0, 3).join(", ")}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {s.source_tier && (
                      <span className="text-xs text-zinc-400">Tier {s.source_tier}</span>
                    )}
                    <span className={`text-xs font-medium ${s.is_accessible ? "text-green-600 dark:text-green-400" : "text-zinc-400"}`}>
                      {s.is_accessible ? "accessible" : "not accessible"}
                    </span>
                    {s.retraction_status === "retracted" && (
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">RETRACTED</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

function VerdictCard({
  verdict,
  score,
  explanation,
  overrides,
}: {
  verdict: string;
  score: number;
  explanation: { summary: string; score_narrative: string; limitations: string[] };
  overrides: Array<{ rule: string; applied: boolean; reason: string }>;
}) {
  const styles: Record<string, { border: string; bg: string; text: string; label: string }> = {
    VERIFIED_ENOUGH_TO_ACT: {
      border: "border-green-300 dark:border-green-700",
      bg: "bg-green-50 dark:bg-green-900/20",
      text: "text-green-900 dark:text-green-100",
      label: "Verified — sufficient to act",
    },
    PARTIALLY_SUPPORTED: {
      border: "border-yellow-300 dark:border-yellow-700",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      text: "text-yellow-900 dark:text-yellow-100",
      label: "Partially supported",
    },
    MIXED_OR_UNCERTAIN: {
      border: "border-orange-300 dark:border-orange-700",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      text: "text-orange-900 dark:text-orange-100",
      label: "Mixed or uncertain",
    },
    UNVERIFIABLE: {
      border: "border-zinc-300 dark:border-zinc-600",
      bg: "bg-zinc-50 dark:bg-zinc-800",
      text: "text-zinc-900 dark:text-zinc-100",
      label: "Unverifiable",
    },
    CONTRADICTED: {
      border: "border-red-300 dark:border-red-700",
      bg: "bg-red-50 dark:bg-red-900/20",
      text: "text-red-900 dark:text-red-100",
      label: "Contradicted by evidence",
    },
    REQUIRES_QUALIFIED_REVIEW: {
      border: "border-purple-300 dark:border-purple-700",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      text: "text-purple-900 dark:text-purple-100",
      label: "Requires qualified review",
    },
  };

  const style = styles[verdict] ?? styles["UNVERIFIABLE"]!;
  const appliedOverrides = overrides.filter((o) => o.applied);

  return (
    <section className={`rounded-xl border ${style.border} ${style.bg} px-5 py-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Verdict
          </p>
          <p className={`mt-1 text-xl font-bold ${style.text}`}>{style.label}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Score
          </p>
          <p className={`mt-1 text-2xl font-bold font-mono ${style.text}`}>{score}/100</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{explanation.summary}</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
          Score breakdown
        </summary>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 font-mono leading-relaxed">
          {explanation.score_narrative}
        </p>
      </details>

      {appliedOverrides.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Policy overrides applied:</p>
          {appliedOverrides.map((o) => (
            <p key={o.rule} className="text-xs text-zinc-700 dark:text-zinc-300">
              <span className="font-mono font-semibold">Rule {o.rule}:</span> {o.reason}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function RerunButton({ caseId }: { caseId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        // Server action: re-run from the beginning
        const { createClient: sc } = await import("@/lib/supabase/server");
        const supabase = await sc();
        await supabase
          .from("verification_cases")
          .update({ status: "queued", error_message: null })
          .eq("id", caseId);
        await supabase.from("verification_jobs").insert({
          case_id: caseId,
          job_type: "full_pipeline",
          payload: {},
          status: "queued",
          attempts: 0,
          run_after: new Date().toISOString(),
        });
      }}
    >
      <button
        type="submit"
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition"
      >
        Retry
      </button>
    </form>
  );
}
