import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CaseStatus } from "@/lib/supabase/types";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { status, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("verification_cases")
    .select("id,title,status,public_verdict,score,input_type,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status as CaseStatus);
  }

  const { data: cases, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / limit);

  const statusOptions = ["queued", "processing", "completed", "failed", "cancelled"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Verification cases</h1>
        <Link
          href="/verify"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          New case
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/cases"
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            !status
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          All
        </Link>
        {statusOptions.map((s) => (
          <Link
            key={s}
            href={`/cases?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              status === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {!cases || cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No cases found.
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {c.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {c.input_type} · {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="ml-4 flex items-center gap-2 shrink-0">
                {c.score !== null && (
                  <span className="text-xs font-mono text-zinc-500">{c.score}/100</span>
                )}
                {c.public_verdict && <VerdictChip verdict={c.public_verdict} />}
                <StatusChip status={c.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/cases?page=${page - 1}${status ? `&status=${status}` : ""}`}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Previous
            </Link>
          )}
          <span className="px-3 py-1.5 text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/cases?page=${page + 1}${status ? `&status=${status}` : ""}`}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  };
  const cls = styles[status] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function VerdictChip({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    VERIFIED_ENOUGH_TO_ACT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    PARTIALLY_SUPPORTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    MIXED_OR_UNCERTAIN: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    UNVERIFIABLE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    CONTRADICTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    REQUIRES_QUALIFIED_REVIEW: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  };
  const shortLabel: Record<string, string> = {
    VERIFIED_ENOUGH_TO_ACT: "Verified",
    PARTIALLY_SUPPORTED: "Partial",
    MIXED_OR_UNCERTAIN: "Mixed",
    UNVERIFIABLE: "Unverifiable",
    CONTRADICTED: "Contradicted",
    REQUIRES_QUALIFIED_REVIEW: "Needs review",
  };
  const cls = styles[verdict] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {shortLabel[verdict] ?? verdict}
    </span>
  );
}
