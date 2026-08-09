"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type InputType = "text" | "url" | "doi_list";

export default function VerifyPage() {
  const router = useRouter();
  const [inputType, setInputType] = useState<InputType>("text");
  const [title, setTitle] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      title: title.trim(),
      input_type: inputType,
    };

    if (inputType === "text" || inputType === "doi_list") {
      body.raw_input = rawInput.trim();
    } else if (inputType === "url") {
      body.source_url = sourceUrl.trim();
    }

    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { id?: string; error?: string };

    if (!res.ok || !data.id) {
      setError(data.error ?? "Failed to submit case");
      setLoading(false);
      return;
    }

    router.push(`/cases/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Submit for verification
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Paste text, a URL, or DOIs. The system will extract claims and check them against real
        sources — results are traceable and scored, never just LLM confidence.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of what you're verifying"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <fieldset>
            <legend className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Input type
            </legend>
            <div className="flex gap-4">
              {(["text", "url", "doi_list"] as InputType[]).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="inputType"
                    value={t}
                    checked={inputType === t}
                    onChange={() => setInputType(t)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">
                    {t === "doi_list" ? "DOI list" : t}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {(inputType === "text" || inputType === "doi_list") && (
          <div>
            <label htmlFor="rawInput" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {inputType === "doi_list" ? "DOIs (one per line or comma-separated)" : "Text to verify"}
            </label>
            <textarea
              id="rawInput"
              required
              maxLength={500000}
              rows={inputType === "doi_list" ? 5 : 10}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={
                inputType === "doi_list"
                  ? "10.1234/example\n10.5678/another"
                  : "Paste the text containing claims you want to verify…"
              }
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>
        )}

        {inputType === "url" && (
          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              URL
            </label>
            <input
              id="sourceUrl"
              type="url"
              required
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        )}

        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <strong>How scoring works:</strong> Verdicts come from source tier, accessibility,
          entailment, and corroboration — not from AI confidence. High-stakes uncertainty routes to
          expert review.
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
          {loading ? "Submitting…" : "Start verification"}
        </button>
      </form>
    </div>
  );
}
