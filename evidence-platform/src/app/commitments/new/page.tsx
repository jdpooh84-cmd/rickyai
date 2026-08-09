"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCommitmentPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [commitmentText, setCommitmentText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [committedAt, setCommittedAt] = useState("");
  const [committerName, setCommitterName] = useState("");
  const [committerRole, setCommitterRole] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      title: title.trim(),
      commitment_text: commitmentText.trim(),
    };
    if (description.trim()) body.description = description.trim();
    if (sourceUrl.trim()) body.source_url = sourceUrl.trim();
    if (committedAt.trim()) body.committed_at = committedAt.trim();
    if (committerName.trim()) body.committer_name = committerName.trim();
    if (committerRole.trim()) body.committer_role = committerRole.trim();

    const res = await fetch("/api/commitments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { id?: string; error?: string };

    if (!res.ok || !data.id) {
      setError(data.error ?? "Failed to create commitment");
      setLoading(false);
      return;
    }

    router.push(`/commitments/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/commitments" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Commitments
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Track a commitment</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Record a public commitment and later evaluate whether evidence shows it was honored.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief label for this commitment"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="commitmentText" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Commitment text <span className="text-red-500">*</span>
          </label>
          <textarea
            id="commitmentText"
            required
            minLength={10}
            maxLength={10000}
            rows={5}
            value={commitmentText}
            onChange={(e) => setCommitmentText(e.target.value)}
            placeholder="Paste the exact commitment statement…"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description
          </label>
          <textarea
            id="description"
            maxLength={5000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Context, background, or notes…"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="committerName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Committer name
            </label>
            <input
              id="committerName"
              type="text"
              maxLength={200}
              value={committerName}
              onChange={(e) => setCommitterName(e.target.value)}
              placeholder="Jane Smith"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="committerRole" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Role / title
            </label>
            <input
              id="committerRole"
              type="text"
              maxLength={200}
              value={committerRole}
              onChange={(e) => setCommitterRole(e.target.value)}
              placeholder="CEO, Minister, etc."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="committedAt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Date committed
            </label>
            <input
              id="committedAt"
              type="date"
              value={committedAt}
              onChange={(e) => setCommittedAt(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Source URL
            </label>
            <input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/statement"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save commitment"}
        </button>
      </form>
    </div>
  );
}
