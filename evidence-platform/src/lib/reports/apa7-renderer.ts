import type { DoiStatus, RetractionStatus, SourceIdentityStatus } from "@/lib/supabase/types";

export const APA7_RENDERER_VERSION = "1.0.0";

export interface SourceForApa {
  id: string;
  source_type: "doi" | "url" | "upload";
  raw_identifier: string;
  normalized_identifier: string | null;
  title: string | null;
  authors: string[] | null;
  published_at: string | null;
  journal: string | null;
  identity_status: SourceIdentityStatus | null;
  doi_status: DoiStatus | null;
  retraction_status: RetractionStatus | null;
  is_accessible: boolean;
  metadata: Record<string, unknown> | null;
}

export type ApaLimitationReason =
  | "not_linked_to_claim"
  | "retracted"
  | "metadata_mismatch"
  | "not_verified"
  | "insufficient_metadata"
  | "upload_type";

export interface ApaLimitation {
  source_id: string;
  raw_identifier: string;
  reason: ApaLimitationReason;
  detail: string;
}

export interface ApaRenderResult {
  rendered: string[];
  source_ids: string[];
  limitations: ApaLimitation[];
  renderer_version: string;
}

// ─── Eligibility ────────────────────────────────────────────────────────────

type EligibilityCheck =
  | { eligible: true }
  | { eligible: false; reason: ApaLimitationReason; detail: string };

function checkEligibility(source: SourceForApa, linkedIds: Set<string>): EligibilityCheck {
  // Upload types have no public identifier and cannot appear in APA output.
  if (source.source_type === "upload") {
    return { eligible: false, reason: "upload_type", detail: "File uploads have no public citation identifier." };
  }

  // Must be linked to at least one claim in this report.
  if (!linkedIds.has(source.id)) {
    return {
      eligible: false,
      reason: "not_linked_to_claim",
      detail: "Source is not linked to any claim in this report.",
    };
  }

  // Retracted sources cannot appear as evidence in APA output.
  if (source.retraction_status === "retracted") {
    return {
      eligible: false,
      reason: "retracted",
      detail: "Source has been retracted and must not appear as evidence in APA output.",
    };
  }

  // Metadata mismatch means the DOI resolves to different content than what was submitted.
  if (source.doi_status === "metadata_mismatch") {
    return {
      eligible: false,
      reason: "metadata_mismatch",
      detail: "DOI metadata does not match the submitted citation; cannot render without fabricating correct values.",
    };
  }

  // Only sources with verified or metadata_only identity can be rendered.
  // "verified" = Crossref/DataCite confirmed. "metadata_only" = accessible URL but unstructured.
  if (source.identity_status !== "verified" && source.identity_status !== "metadata_only") {
    return {
      eligible: false,
      reason: "not_verified",
      detail: `Source identity status is "${source.identity_status ?? "null"}"; only "verified" and "metadata_only" sources may appear in APA output.`,
    };
  }

  // Minimum metadata: title must be present.
  if (!source.title) {
    return {
      eligible: false,
      reason: "insufficient_metadata",
      detail: "No title available; cannot render APA reference without inventing one.",
    };
  }

  return { eligible: true };
}

// ─── Author formatting ───────────────────────────────────────────────────────

// Authors are stored as "Given Family" strings from Crossref (e.g., "John Smith").
// APA 7 requires "Family, G." format. We apply a best-effort last-word-is-family heuristic.
// This is noted as a limitation for compound family names; no value is invented.
export function formatAuthorInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return fullName;
  if (parts.length === 1) return parts[0]!;

  const family = parts[parts.length - 1]!;
  const givenParts = parts.slice(0, parts.length - 1);
  const initials = givenParts
    .map((p) => (p ? p[0]!.toUpperCase() + "." : ""))
    .filter(Boolean)
    .join(" ");

  return initials ? `${family}, ${initials}` : family;
}

// APA 7 §9.7: up to 20 authors listed. If >20, list first 19, then "...", then last author.
export function formatAuthorList(authors: string[]): string {
  if (authors.length === 0) return "";

  const formatted = authors.map(formatAuthorInitials);

  if (formatted.length === 1) return formatted[0] ?? "";
  if (formatted.length <= 20) {
    const allButLast = formatted.slice(0, -1);
    const last = formatted[formatted.length - 1] ?? "";
    return `${allButLast.join(", ")}, & ${last}`;
  }

  // >20 authors
  const first19 = formatted.slice(0, 19).join(", ");
  const last = formatted[formatted.length - 1] ?? "";
  return `${first19}, . . . ${last}`;
}

// ─── Date formatting ─────────────────────────────────────────────────────────

// Extract year from stored ISO date string (YYYY-01-01 format used by worker).
export function extractYear(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const match = /^(\d{4})/.exec(publishedAt);
  return match?.[1] ?? null;
}

// ─── Per-type renderers ──────────────────────────────────────────────────────

function renderDoiSource(source: SourceForApa): string {
  const authorStr = source.authors && source.authors.length > 0 ? formatAuthorList(source.authors) : null;
  const year = extractYear(source.published_at);
  const yearStr = year ? `(${year})` : "(n.d.)";
  const title = source.title!; // eligibility already confirmed title is present

  const meta = source.metadata ?? {};
  const volume = typeof meta.volume === "string" ? meta.volume : null;
  const issue = typeof meta.issue === "string" ? meta.issue : null;
  const pages = typeof meta.pages === "string" ? meta.pages : null;

  // Build location part: journal, volume, issue, pages
  let locationPart = "";
  if (source.journal) {
    locationPart = source.journal;
    if (volume) {
      locationPart += `, ${volume}`;
      if (issue) locationPart += `(${issue})`;
    }
    if (pages) locationPart += `, ${pages}`;
  }

  const doiUrl = source.normalized_identifier
    ? `https://doi.org/${source.normalized_identifier}`
    : null;

  // Assemble parts
  const parts: string[] = [];
  if (authorStr) parts.push(`${authorStr} ${yearStr}.`);
  else parts.push(`${yearStr}.`);

  parts.push(`${title}.`);
  if (locationPart) parts.push(`${locationPart}.`);
  if (doiUrl) parts.push(doiUrl);

  return parts.join(" ");
}

function renderUrlSource(source: SourceForApa): string {
  const authorStr = source.authors && source.authors.length > 0 ? formatAuthorList(source.authors) : null;
  const year = extractYear(source.published_at);
  const yearStr = year ? `(${year})` : "(n.d.)";
  const title = source.title!;

  const parts: string[] = [];
  if (authorStr) parts.push(`${authorStr} ${yearStr}.`);
  else parts.push(`${yearStr}.`);

  parts.push(`${title}.`);

  if (source.raw_identifier) parts.push(source.raw_identifier);

  return parts.join(" ");
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function renderApa7References(
  sources: SourceForApa[],
  linkedSourceIds: Set<string>,
): ApaRenderResult {
  const rendered: string[] = [];
  const source_ids: string[] = [];
  const limitations: ApaLimitation[] = [];

  for (const source of sources) {
    const check = checkEligibility(source, linkedSourceIds);

    if (!check.eligible) {
      limitations.push({
        source_id: source.id,
        raw_identifier: source.raw_identifier,
        reason: check.reason,
        detail: check.detail,
      });
      continue;
    }

    let ref: string;
    if (source.source_type === "doi") {
      ref = renderDoiSource(source);
    } else {
      ref = renderUrlSource(source);
    }

    rendered.push(ref);
    source_ids.push(source.id);
  }

  // Sort alphabetically by first character of rendered string (APA 7 §9.44)
  const paired = rendered.map((r, i) => ({ ref: r, id: source_ids[i]! }));
  paired.sort((a, b) => a.ref.localeCompare(b.ref));

  return {
    rendered: paired.map((p) => p.ref),
    source_ids: paired.map((p) => p.id),
    limitations,
    renderer_version: APA7_RENDERER_VERSION,
  };
}
