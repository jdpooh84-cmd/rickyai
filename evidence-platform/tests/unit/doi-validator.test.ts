import { describe, it, expect } from "vitest";
import { normalizeDoi } from "@/lib/retrieval/doi-validator";

describe("normalizeDoi", () => {
  it("normalizes a plain DOI", () => {
    const result = normalizeDoi("10.1038/nature12345");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("10.1038/nature12345");
  });

  it("strips doi: prefix", () => {
    const result = normalizeDoi("doi:10.1038/nature12345");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("10.1038/nature12345");
  });

  it("strips https://doi.org/ prefix", () => {
    const result = normalizeDoi("https://doi.org/10.1038/nature12345");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("10.1038/nature12345");
  });

  it("strips trailing period", () => {
    const result = normalizeDoi("10.1038/nature12345.");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("10.1038/nature12345");
  });

  it("rejects a DOI with wrong prefix", () => {
    const result = normalizeDoi("20.1038/nature12345");
    expect(result.isValid).toBe(false);
    expect(result.normalized).toBeNull();
  });

  it("rejects a random string", () => {
    const result = normalizeDoi("not-a-doi");
    expect(result.isValid).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = normalizeDoi("");
    expect(result.isValid).toBe(false);
  });

  it("lowercases the DOI", () => {
    const result = normalizeDoi("10.1038/NATURE12345");
    expect(result.normalized).toBe("10.1038/nature12345");
  });

  it("does not repair or guess missing DOI characters", () => {
    const mutated = "10.10938/naturex2345";
    const result = normalizeDoi(mutated);
    expect(result.normalized).toBe(mutated.toLowerCase());
  });
});
