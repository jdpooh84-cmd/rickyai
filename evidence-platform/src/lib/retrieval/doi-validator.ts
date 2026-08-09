import "server-only";
import type { DoiStatus } from "@/lib/supabase/types";

const DOI_SYNTAX_RE = /^10\.\d{4,}(?:\.\d+)*\/[^\s]+$/;
const CROSSREF_API = "https://api.crossref.org/works/";
const DATACITE_API = "https://api.datacite.org/dois/";
const DOI_RESOLVER = "https://doi.org/";

export interface DoiNormalized {
  raw: string;
  normalized: string | null;
  isValid: boolean;
}

export interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: Array<{ family?: string; given?: string }>;
  "container-title"?: string[];
  published?: { "date-parts": number[][] };
  publisher?: string;
  type?: string;
  volume?: string;
  issue?: string;
  page?: string;
  "update-to"?: Array<{ type: string }>;
}

export interface DoiValidationResult {
  doi: string;
  status: DoiStatus;
  metadata: {
    title: string | null;
    authors: string[];
    year: number | null;
    journal: string | null;
    publisher: string | null;
    work_type: string | null;
    volume: string | null;
    issue: string | null;
    pages: string | null;
    is_retracted: boolean;
  } | null;
  resolves: boolean;
  registry: "crossref" | "datacite" | "unknown";
}

export function normalizeDoi(raw: string): DoiNormalized {
  let s = raw.trim();

  s = s.replace(/[.!?,;]+$/, "");
  s = s.replace(/^(?:doi:|https?:\/\/(?:dx\.)?doi\.org\/)/i, "");
  s = s.toLowerCase();

  const isValid = DOI_SYNTAX_RE.test(s);
  return { raw, normalized: isValid ? s : null, isValid };
}

async function resolveDoi(doi: string): Promise<boolean> {
  try {
    const resp = await fetch(`${DOI_RESOLVER}${encodeURIComponent(doi)}`, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    return resp.ok || resp.redirected;
  } catch {
    return false;
  }
}

async function queryCrossref(doi: string): Promise<CrossrefWork | null> {
  try {
    const resp = await fetch(`${CROSSREF_API}${encodeURIComponent(doi)}`, {
      headers: { "User-Agent": "EvidencePlatform/0.1 (mailto:support@evidenceplatform.app)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { message?: CrossrefWork };
    return json.message ?? null;
  } catch {
    return null;
  }
}

async function queryDatacite(doi: string): Promise<{ title?: string; retracted?: boolean } | null> {
  try {
    const resp = await fetch(`${DATACITE_API}${encodeURIComponent(doi)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { data?: { attributes?: { titles?: Array<{ title: string }> } } };
    const attrs = json.data?.attributes;
    if (!attrs) return null;
    return { title: attrs.titles?.[0]?.title };
  } catch {
    return null;
  }
}

export interface CitationToCompare {
  title?: string;
  authors?: string[];
  year?: number;
  journal?: string;
}

function compareMetadata(work: CrossrefWork, citation: CitationToCompare): boolean {
  const workTitle = (work.title[0] ?? "").toLowerCase();
  const citTitle = (citation.title ?? "").toLowerCase();

  if (citTitle && workTitle) {
    const similarity = citTitle.length > 0 && workTitle.includes(citTitle.slice(0, 20));
    if (!similarity) return false;
  }

  if (citation.year) {
    const pubYear = work.published?.["date-parts"]?.[0]?.[0];
    if (pubYear && Math.abs(pubYear - citation.year) > 1) return false;
  }

  if (citation.authors && citation.authors.length > 0) {
    const workAuthors = (work.author ?? []).map((a) => (a.family ?? "").toLowerCase());
    const citAuthors = citation.authors.map((a) => a.toLowerCase());
    const anyMatch = citAuthors.some((ca) => workAuthors.some((wa) => wa.includes(ca) || ca.includes(wa)));
    if (!anyMatch) return false;
  }

  return true;
}

export async function validateDoi(
  raw: string,
  citation?: CitationToCompare,
): Promise<DoiValidationResult> {
  const { normalized, isValid } = normalizeDoi(raw);

  if (!isValid || !normalized) {
    return {
      doi: raw,
      status: "invalid_format",
      metadata: null,
      resolves: false,
      registry: "unknown",
    };
  }

  const crossrefWork = await queryCrossref(normalized);

  if (crossrefWork) {
    const isRetracted =
      (crossrefWork["update-to"] ?? []).some((u) =>
        ["retraction", "correction"].includes(u.type.toLowerCase()),
      );

    if (isRetracted) {
      return {
        doi: normalized,
        status: "retracted",
        metadata: null,
        resolves: true,
        registry: "crossref",
      };
    }

    const metadata = {
      title: crossrefWork.title[0] ?? null,
      authors: (crossrefWork.author ?? []).map(
        (a) => [a.given, a.family].filter(Boolean).join(" ").trim(),
      ),
      year: crossrefWork.published?.["date-parts"]?.[0]?.[0] ?? null,
      journal: crossrefWork["container-title"]?.[0] ?? null,
      publisher: crossrefWork.publisher ?? null,
      work_type: crossrefWork.type ?? null,
      volume: crossrefWork.volume ?? null,
      issue: crossrefWork.issue ?? null,
      pages: crossrefWork.page ?? null,
      is_retracted: false,
    };

    if (citation) {
      const matches = compareMetadata(crossrefWork, citation);
      return {
        doi: normalized,
        status: matches ? "crossref_found" : "metadata_mismatch",
        metadata,
        resolves: true,
        registry: "crossref",
      };
    }

    return {
      doi: normalized,
      status: "crossref_found",
      metadata,
      resolves: true,
      registry: "crossref",
    };
  }

  const dataciteWork = await queryDatacite(normalized);
  if (dataciteWork) {
    return {
      doi: normalized,
      status: "datacite_found",
      metadata: {
        title: dataciteWork.title ?? null,
        authors: [],
        year: null,
        journal: null,
        publisher: null,
        work_type: null,
        volume: null,
        issue: null,
        pages: null,
        is_retracted: dataciteWork.retracted ?? false,
      },
      resolves: true,
      registry: "datacite",
    };
  }

  const resolves = await resolveDoi(normalized);
  return {
    doi: normalized,
    status: resolves ? "valid_found" : "valid_not_found",
    metadata: null,
    resolves,
    registry: "unknown",
  };
}
