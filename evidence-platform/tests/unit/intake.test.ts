import { describe, it, expect } from "vitest";
import { hashText, normalizeText, extractDoiList, sanitizeStoragePath } from "@/lib/verification/intake";

describe("hashText", () => {
  it("produces a hex string of length 64", () => {
    const hash = hashText("hello world");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    expect(hashText("same")).toBe(hashText("same"));
  });

  it("differs for different inputs", () => {
    expect(hashText("a")).not.toBe(hashText("b"));
  });
});

describe("normalizeText", () => {
  it("normalizes CRLF to LF", () => {
    expect(normalizeText("a\r\nb")).toBe("a\nb");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });
});

describe("extractDoiList", () => {
  it("extracts DOIs from plain text", () => {
    const text = "See Smith et al. 10.1038/nature12345 and Jones 10.1016/j.cell.2020.01.001";
    const dois = extractDoiList(text);
    expect(dois).toContain("10.1038/nature12345");
    expect(dois).toContain("10.1016/j.cell.2020.01.001");
  });

  it("deduplicates DOIs", () => {
    const text = "10.1038/nature12345 10.1038/nature12345";
    const dois = extractDoiList(text);
    expect(dois).toHaveLength(1);
  });

  it("returns empty array for no DOIs", () => {
    expect(extractDoiList("no dois here")).toEqual([]);
  });
});

describe("sanitizeStoragePath", () => {
  it("produces organization-scoped paths", () => {
    const path = sanitizeStoragePath("org-123", "case-456", "report.pdf");
    expect(path).toBe("orgs/org-123/cases/case-456/report.pdf");
  });

  it("sanitizes dangerous characters from filenames", () => {
    const path = sanitizeStoragePath("org-1", "case-1", "../../../etc/passwd");
    expect(path).not.toContain("..");
    expect(path).not.toContain("/etc/passwd");
  });
});
