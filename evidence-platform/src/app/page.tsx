import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="max-w-2xl">
        <span className="inline-block mb-4 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          Evidence before fluency
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Evidence Assurance Platform
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Verify factual claims against real published evidence. Every verdict is traceable to
          stored sources, passages, and audit events — never to LLM confidence alone.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/verify"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Submit a claim for verification
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3 text-left">
          {[
            {
              title: "Source-anchored verdicts",
              body: "Scores come from evidence tier, accessibility, entailment, corroboration, and freshness — not from model confidence.",
            },
            {
              title: "Adversarial review",
              body: "A separate AI invocation plays prosecutor: flagging fabricated citations, missing context, and high-stakes risks.",
            },
            {
              title: "Commitment accountability",
              body: "Track commitments and evaluate whether evidence shows they were honored — verdict backed by explicit reasoning.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{card.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
