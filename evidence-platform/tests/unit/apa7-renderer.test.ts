import { describe, it, expect } from "vitest";
import {
  renderApa7References,
  formatAuthorInitials,
  formatAuthorList,
  extractYear,
  APA7_RENDERER_VERSION,
  type SourceForApa,
} from "@/lib/reports/apa7-renderer";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<SourceForApa> & { id: string }): SourceForApa {
  return {
    source_type: "doi",
    raw_identifier: `10.1234/test.${overrides.id}`,
    normalized_identifier: `10.1234/test.${overrides.id}`,
    title: "A Verified Study",
    authors: ["Alice Smith", "Bob Jones"],
    published_at: "2023-01-01",
    journal: "Journal of Testing",
    identity_status: "verified",
    doi_status: "crossref_found",
    retraction_status: "current",
    is_accessible: true,
    metadata: null,
    ...overrides,
  };
}

const LINKED = new Set(["s1", "s2", "s3", "s4", "s5", "s6"]);

// ── formatAuthorInitials ──────────────────────────────────────────────────────

describe("formatAuthorInitials", () => {
  it("converts 'Given Family' to 'Family, G.'", () => {
    expect(formatAuthorInitials("John Smith")).toBe("Smith, J.");
  });

  it("handles two given names", () => {
    expect(formatAuthorInitials("John Robert Smith")).toBe("Smith, J. R.");
  });

  it("returns single-token names as-is", () => {
    expect(formatAuthorInitials("Anonymous")).toBe("Anonymous");
  });

  it("handles empty string", () => {
    expect(formatAuthorInitials("")).toBe("");
  });
});

// ── formatAuthorList ──────────────────────────────────────────────────────────

describe("formatAuthorList", () => {
  it("renders single author", () => {
    expect(formatAuthorList(["John Smith"])).toBe("Smith, J.");
  });

  it("renders two authors with ampersand", () => {
    const result = formatAuthorList(["Alice Brown", "Bob White"]);
    expect(result).toBe("Brown, A., & White, B.");
  });

  it("renders three authors separated by commas and ampersand", () => {
    const result = formatAuthorList(["Alice Brown", "Bob White", "Carol Green"]);
    expect(result).toBe("Brown, A., White, B., & Green, C.");
  });

  it("renders 20 authors with no ellipsis", () => {
    const authors = Array.from({ length: 20 }, (_, i) => `Author${i} Name`);
    const result = formatAuthorList(authors);
    expect(result).not.toContain(". . .");
    expect(result).toContain("& Name, A.");
  });

  it("renders >20 authors with ellipsis and last author", () => {
    const authors = Array.from({ length: 22 }, (_, i) => `Author${i} Name`);
    const result = formatAuthorList(authors);
    expect(result).toContain(". . .");
    expect(result.endsWith("Name, A.")).toBe(true);
  });
});

// ── extractYear ───────────────────────────────────────────────────────────────

describe("extractYear", () => {
  it("extracts year from ISO date", () => {
    expect(extractYear("2021-01-01")).toBe("2021");
  });

  it("returns null for null input", () => {
    expect(extractYear(null)).toBe(null);
  });

  it("returns null for invalid date string", () => {
    expect(extractYear("not-a-date")).toBe(null);
  });
});

// ── renderApa7References — eligibility filters ────────────────────────────────

describe("renderApa7References — eligibility", () => {
  it("FIXTURE 1: renders eligible verified DOI source", () => {
    const source = makeSource({ id: "s1" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(1);
    expect(result.rendered[0]).toContain("A Verified Study");
    expect(result.rendered[0]).toContain("https://doi.org/");
    expect(result.limitations).toHaveLength(0);
    expect(result.renderer_version).toBe(APA7_RENDERER_VERSION);
  });

  it("FIXTURE 2: retracted source is excluded", () => {
    const source = makeSource({ id: "s2", retraction_status: "retracted" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations).toHaveLength(1);
    expect(result.limitations[0]!.reason).toBe("retracted");
  });

  it("FIXTURE 3: source with metadata_mismatch doi_status is excluded", () => {
    const source = makeSource({ id: "s3", doi_status: "metadata_mismatch" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations[0]!.reason).toBe("metadata_mismatch");
  });

  it("FIXTURE 4: unverified source (not_found) is excluded", () => {
    const source = makeSource({ id: "s4", identity_status: "not_found" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations[0]!.reason).toBe("not_verified");
  });

  it("FIXTURE 5: source not linked to any claim is excluded", () => {
    const source = makeSource({ id: "unlinked-source" });
    const result = renderApa7References([source], LINKED); // LINKED does not contain "unlinked-source"
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations[0]!.reason).toBe("not_linked_to_claim");
  });

  it("FIXTURE 6: source with no title is excluded", () => {
    const source = makeSource({ id: "s5", title: null });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations[0]!.reason).toBe("insufficient_metadata");
  });

  it("FIXTURE 7: upload-type source is excluded regardless of other fields", () => {
    const source = makeSource({ id: "s6", source_type: "upload" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations[0]!.reason).toBe("upload_type");
  });

  it("FIXTURE 8: unresolved identity_status is excluded", () => {
    const source = makeSource({ id: "s6", identity_status: "unresolved" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations[0]!.reason).toBe("not_verified");
  });

  it("FIXTURE 9: invalid identity_status is excluded", () => {
    const source = makeSource({ id: "s6", identity_status: "invalid" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(0);
    expect(result.limitations[0]!.reason).toBe("not_verified");
  });

  it("FIXTURE 10: metadata_only URL source with title is included", () => {
    const source = makeSource({
      id: "s6",
      source_type: "url",
      identity_status: "metadata_only",
      doi_status: null,
      normalized_identifier: null,
    });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(1);
    expect(result.rendered[0]).toContain("A Verified Study");
  });
});

// ── renderApa7References — output format ──────────────────────────────────────

describe("renderApa7References — format", () => {
  it("DOI source includes doi.org URL", () => {
    const source = makeSource({ id: "s1", normalized_identifier: "10.9999/test.001" });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered[0]).toContain("https://doi.org/10.9999/test.001");
  });

  it("DOI source with volume/issue/pages from metadata includes them", () => {
    const source = makeSource({
      id: "s1",
      metadata: { volume: "42", issue: "3", pages: "101-115" },
    });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered[0]).toContain("42(3)");
    expect(result.rendered[0]).toContain("101-115");
  });

  it("DOI source without volume omits volume/issue/pages gracefully", () => {
    const source = makeSource({ id: "s1", metadata: null });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered[0]).not.toContain("undefined");
    expect(result.rendered[0]).not.toContain("null");
  });

  it("source with no authors still renders without erroring", () => {
    const source = makeSource({ id: "s1", authors: null });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered).toHaveLength(1);
    expect(result.rendered[0]).toContain("A Verified Study");
  });

  it("uses n.d. when no publication date available", () => {
    const source = makeSource({ id: "s1", published_at: null });
    const result = renderApa7References([source], LINKED);
    expect(result.rendered[0]).toContain("(n.d.)");
  });

  it("results are sorted alphabetically", () => {
    const s1 = makeSource({ id: "s1", title: "Zebra Study" });
    const s2 = makeSource({ id: "s2", title: "Alpha Study" });
    // Use separate linked sets that include both
    const result = renderApa7References([s1, s2], new Set(["s1", "s2"]));
    expect(result.rendered[0]).toContain("Alpha Study");
    expect(result.rendered[1]).toContain("Zebra Study");
  });

  it("source_ids array matches rendered array order", () => {
    const s1 = makeSource({ id: "s1", title: "Zebra Study" });
    const s2 = makeSource({ id: "s2", title: "Alpha Study" });
    const result = renderApa7References([s1, s2], new Set(["s1", "s2"]));
    // Alpha comes first alphabetically; s2 has title "Alpha Study"
    expect(result.source_ids[0]).toBe("s2");
    expect(result.source_ids[1]).toBe("s1");
  });

  it("renderer_version field is present", () => {
    const result = renderApa7References([], new Set());
    expect(result.renderer_version).toBe(APA7_RENDERER_VERSION);
  });
});
