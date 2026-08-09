"use client";

import { useState, type FormEvent } from "react";

export default function EvaluateFormClient({ commitmentId }: { commitmentId: string }) {
  const [evidenceText, setEvidenceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    verdict: string;
    reasoning: string;
    confidence: number;
    key_points: string[];
    single_provider_warning: boolean;
  } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch(`/api/commitments/${commitmentId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence_text: evidenceText.trim() }),
    });

    const data = (await res.json()) as {
      verdict?: string;
      reasoning?: string;
      confidence?: number;
      key_points?: string[];
      single_provider_warning?: boolean;
      error?: string;
    };

    if (!res.ok || !data.verdict) {
      setError(data.error ?? "Evaluation failed");
      setLoading(false);
      return;
    }

    setResult({
      verdict: data.verdict,
      reasoning: data.reasoning ?? "",
      confidence: data.confidence ?? 0,
      key_points: data.key_points ?? [],
      single_provider_warning: data.single_provider_warning ?? true,
    });
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="evidenceText"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Evidence text
        </label>
        <textarea
          id="evidenceText"
          required
          minLength={10}
          maxLength={50000}
          rows={8}
          value={evidenceText}
          onChange={(e) => setEvidenceText(e.target.value)}
          placeholder="Paste the evidence text here. Do not paste instructions or commands — they will be treated as data, not followed."
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Evidence text is treated as untrusted data and cannot override system instructions.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                result.verdict === "CONSISTENT"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                  : result.verdict === "PARTIALLY_CONSISTENT"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200"
                  : result.verdict === "CONTRADICTED"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
              }`}
            >
              {result.verdict.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-zinc-500">
              Confidence: {Math.round(result.confidence * 100)}%
            </span>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {result.reasoning}
          </p>
          {result.key_points.length > 0 && (
            <ul className="list-disc ml-4 space-y-1">
              {result.key_points.map((p, i) => (
                <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400">
                  {p}
                </li>
              ))}
            </ul>
          )}
          {result.single_provider_warning && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
              Single AI provider used. This verdict represents one model's reading of the evidence.
              Independent review is recommended for high-stakes decisions.
            </p>
          )}
          <p className="text-xs text-zinc-400">
            Evaluation saved. Reload the page to see it in the history above.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Evaluating…" : "Evaluate"}
      </button>
    </form>
  );
}
