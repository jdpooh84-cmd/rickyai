import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CommitmentStatus } from "@/lib/supabase/types";

export default async function CommitmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { status } = await searchParams;

  let query = supabase
    .from("commitments")
    .select("id,title,status,committer_name,committed_at,created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as CommitmentStatus);

  const { data: commitments } = await query;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Commitments</h1>
        <Link
          href="/commitments/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          New commitment
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[undefined, "active", "fulfilled", "expired", "cancelled"].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/commitments?status=${s}` : "/commitments"}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              status === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {s ?? "All"}
          </Link>
        ))}
      </div>

      {!commitments || commitments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No commitments tracked yet.{" "}
          <Link href="/commitments/new" className="text-blue-600 hover:underline">
            Add the first one
          </Link>
          .
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {commitments.map((c) => (
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
                  {c.committer_name && `${c.committer_name} · `}
                  {c.committed_at
                    ? new Date(c.committed_at).toLocaleDateString()
                    : new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <StatusChip status={c.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    fulfilled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    expired: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    cancelled: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}
