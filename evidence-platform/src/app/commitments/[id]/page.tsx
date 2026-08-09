import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EvaluateFormClient from "./EvaluateFormClient";

type PageParams = { params: Promise<{ id: string }> };

export default async function CommitmentDetailPage({ params }: PageParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: commitment } = await supabase
    .from("commitments")
    .select("*")
    .eq("id", id)
    .single();

  if (!commitment) notFound();

  const { data: evaluations } = await supabase
    .from("commitment_evaluations")
    .select("id,verdict,reasoning,evaluated_by,created_at,model,prompt_version")
    .eq("commitment_id", id)
    .order("created_at", { ascending: false });

  const evals = evaluations ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <Link
          href="/commitments"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Commitments
        </Link>
        <div className="mt-4 flex items-start justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 break-words">
              {commitment.title}
            </h1>
            {commitment.committer_name && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {commitment.committer_name}
                {commitment.committer_role && ` · ${commitment.committer_role}`}
                {commitment.committed_at &&
                  ` · ${new Date(commitment.committed_at).toLocaleDateString()}`}
              </p>
            )}
            {commitment.source_url && (
              <a
                href={commitment.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400 break-all"
              >
                {commitment.source_url}
              </a>
            )}
          </div>
          <StatusChip status={commitment.status} />
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
          Commitment
        </h2>
        <p className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
          {commitment.commitment_text}
        </p>
        {commitment.description && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap">
            {commitment.description}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Evaluations ({evals.length})
          </h2>
          <EvaluateButton commitmentId={id} />
        </div>

        {evals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No evaluations yet. Submit evidence below to evaluate this commitment.
          </div>
        ) : (
          <div className="space-y-4">
            {evals.map((e) => (
              <EvaluationCard key={e.id} evaluation={e} />
            ))}
          </div>
        )}
      </section>

      <EvaluateForm commitmentId={id} />
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
    <span
      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-sm font-medium capitalize ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}
    >
      {status}
    </span>
  );
}

function VerdictChip({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    CONSISTENT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    PARTIALLY_CONSISTENT:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    CONTRADICTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    NOT_EVALUABLE: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[verdict] ?? "bg-zinc-100 text-zinc-600"}`}
    >
      {verdict.replace(/_/g, " ")}
    </span>
  );
}

function EvaluationCard({
  evaluation,
}: {
  evaluation: {
    id: string;
    verdict: string;
    reasoning: string | null;
    created_at: string;
    model: string | null;
    prompt_version: string | null;
  };
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-2">
        <VerdictChip verdict={evaluation.verdict} />
        <span className="text-xs text-zinc-400">
          {new Date(evaluation.created_at).toLocaleDateString()}
        </span>
      </div>
      {evaluation.reasoning && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {evaluation.reasoning}
        </p>
      )}
      {evaluation.model && (
        <p className="mt-2 text-xs text-zinc-400 font-mono">
          {evaluation.model}
          {evaluation.prompt_version && ` · ${evaluation.prompt_version}`}
        </p>
      )}
    </div>
  );
}

function EvaluateButton({ commitmentId }: { commitmentId: string }) {
  return (
    <a
      href={`#evaluate-${commitmentId}`}
      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
    >
      Add evaluation
    </a>
  );
}

function EvaluateForm({ commitmentId }: { commitmentId: string }) {
  return (
    <section
      id={`evaluate-${commitmentId}`}
      className="rounded-xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
        Evaluate this commitment
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Paste evidence text (news article, report, statement). The system will assess whether the
        commitment was honored — verdict is grounded in the evidence text only.
      </p>
      <EvaluateFormClient commitmentId={commitmentId} />
    </section>
  );
}
