import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [casesResult, commitmentsResult] = await Promise.all([
    supabase
      .from("verification_cases")
      .select("id,title,status,public_verdict,score,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("commitments")
      .select("id,title,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentCases = casesResult.data ?? [];
  const recentCommitments = commitmentsResult.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <Link
          href="/verify"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          New verification
        </Link>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent cases</h2>
          <Link href="/cases" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            View all
          </Link>
        </div>

        {recentCases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No verification cases yet.{" "}
            <Link href="/verify" className="text-blue-600 hover:underline">
              Start one
            </Link>
            .
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {recentCases.map((c) => (
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
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3 shrink-0">
                  {c.public_verdict && (
                    <VerdictBadge verdict={c.public_verdict} />
                  )}
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Commitments</h2>
          <Link href="/commitments" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            View all
          </Link>
        </div>

        {recentCommitments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No commitments tracked yet.{" "}
            <Link href="/commitments/new" className="text-blue-600 hover:underline">
              Add one
            </Link>
            .
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {recentCommitments.map((c) => (
              <Link
                key={c.id}
                href={`/commitments/${c.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {c.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
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
    active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  };
  const cls = styles[status] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    VERIFIED_ENOUGH_TO_ACT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    PARTIALLY_SUPPORTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    MIXED_OR_UNCERTAIN: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    UNVERIFIABLE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    CONTRADICTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    REQUIRES_QUALIFIED_REVIEW: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  };
  const label: Record<string, string> = {
    VERIFIED_ENOUGH_TO_ACT: "Verified",
    PARTIALLY_SUPPORTED: "Partial",
    MIXED_OR_UNCERTAIN: "Mixed",
    UNVERIFIABLE: "Unverifiable",
    CONTRADICTED: "Contradicted",
    REQUIRES_QUALIFIED_REVIEW: "Needs review",
  };
  const cls = styles[verdict] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label[verdict] ?? verdict}
    </span>
  );
}
