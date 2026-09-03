/**
 * Tenant isolation and Growth Intelligence normalization tests.
 * Tests that:
 *   - getGrowthIntelligence returns { available: false } for unknown businessId
 *   - normalizeCompete handles null input correctly
 *   - normalizeCompete handles a real-shaped payload correctly
 *   - normalizeScout handles a real-shaped payload correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGrowthIntelligence, normalizeCompete, normalizeScout } from "@/lib/growth-intelligence";

// Mock the supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe("getGrowthIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { available: false } for an unknown businessId when no rows exist", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    // Chain returns empty rows
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const result = await getGrowthIntelligence("00000000-0000-0000-0000-000000000000");
    expect(result.available).toBe(false);
    expect(result.compete).toBeNull();
    expect(result.scout).toBeNull();
    expect(result.lastUpdatedAt).toBeNull();
  });
});

describe("normalizeCompete", () => {
  it("returns an empty structure with null fields when given null input", () => {
    const result = normalizeCompete(null);
    expect(result.overallGrade).toBeNull();
    expect(result.score).toBeNull();
    expect(result.categoryScores).toEqual({});
    expect(result.categoryGrades).toEqual({});
    expect(result.weaknesses).toEqual([]);
    expect(result.priorities).toEqual([]);
    expect(result.strengths).toEqual([]);
    expect(result.competitiveEdge).toBeNull();
    expect(result.rawData).toBeNull();
  });

  it("extracts score, grade, and weaknesses from a real-shaped payload", () => {
    const payload = {
      score: 72,
      grade: "B+",
      weaknesses: ["Slow response time", "Poor online presence"],
      strengths: ["Strong referral network"],
      priorities: ["Improve Google reviews", "Add online booking"],
      competitiveEdge: "30-year local reputation",
      categoryScores: { "online_presence": 60, "reviews": 80 },
      categoryGrades: { "online_presence": "C", "reviews": "B" },
    };

    const result = normalizeCompete(payload);
    expect(result.score).toBe(72);
    expect(result.overallGrade).toBe("B+");
    expect(result.weaknesses).toEqual(["Slow response time", "Poor online presence"]);
    expect(result.strengths).toEqual(["Strong referral network"]);
    expect(result.priorities).toEqual(["Improve Google reviews", "Add online booking"]);
    expect(result.competitiveEdge).toBe("30-year local reputation");
    expect(result.categoryScores).toEqual({ "online_presence": 60, "reviews": 80 });
    expect(result.rawData).toBe(payload);
  });

  it("falls back to overallScore when score field is absent", () => {
    const payload = { overallScore: 85, overallGrade: "A-" };
    const result = normalizeCompete(payload);
    expect(result.score).toBe(85);
    expect(result.overallGrade).toBe("A-");
  });

  it("returns empty arrays when array fields are missing", () => {
    const payload = { score: 50 };
    const result = normalizeCompete(payload);
    expect(result.weaknesses).toEqual([]);
    expect(result.priorities).toEqual([]);
    expect(result.strengths).toEqual([]);
  });
});

describe("normalizeScout", () => {
  it("extracts competitors and opportunities from a real-shaped payload", () => {
    const payload = {
      marketPosition: "challenger",
      competitors: [
        { name: "Acme HVAC", threatLevel: "high", strengths: ["Big brand"], weaknesses: ["Slow"] },
        { name: "City Plumbing", threatLevel: "medium" },
        "Local Gas Co",
      ],
      opportunities: ["Expand to neighboring city", "Partner with real estate agents"],
      threats: ["New national chain entering market"],
      quickWins: ["Claim Google Business Profile", "Add online booking"],
    };

    const result = normalizeScout(payload);
    expect(result.marketPosition).toBe("challenger");
    expect(result.competitors).toHaveLength(3);
    expect(result.competitors[0].name).toBe("Acme HVAC");
    expect(result.competitors[0].threatLevel).toBe("high");
    expect(result.competitors[0].strengths).toEqual(["Big brand"]);
    expect(result.competitors[0].weaknesses).toEqual(["Slow"]);
    expect(result.competitors[1].name).toBe("City Plumbing");
    expect(result.competitors[2].name).toBe("Local Gas Co");
    expect(result.opportunities).toEqual(["Expand to neighboring city", "Partner with real estate agents"]);
    expect(result.threats).toEqual(["New national chain entering market"]);
    expect(result.quickWins).toEqual(["Claim Google Business Profile", "Add online booking"]);
    expect(result.rawData).toBe(payload);
  });

  it("returns empty structure when given null input", () => {
    const result = normalizeScout(null);
    expect(result.marketPosition).toBeNull();
    expect(result.competitors).toEqual([]);
    expect(result.opportunities).toEqual([]);
    expect(result.threats).toEqual([]);
    expect(result.quickWins).toEqual([]);
    expect(result.rawData).toBeNull();
  });

  it("handles missing optional fields gracefully", () => {
    const payload = { competitors: [] };
    const result = normalizeScout(payload);
    expect(result.competitors).toEqual([]);
    expect(result.opportunities).toEqual([]);
    expect(result.marketPosition).toBeNull();
  });
});
