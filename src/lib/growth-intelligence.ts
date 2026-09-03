/**
 * getGrowthIntelligence — unified bridge between COMPETE/SCOUT strategy data
 * and the Ricky OS execution systems (campaigns, Growth Lab, Profit Yield,
 * Executive Brief, Business Health).
 *
 * COMPETE results live in strategy_outputs where step_number = 3 (Compete).
 * SCOUT results live in strategy_outputs where step_number = 4 (Scout).
 * This function normalizes them into a structured, typed object that
 * execution systems can consume without knowing the raw strategy schema.
 */

import { supabase } from "@/integrations/supabase/client";

export interface CompeteIntelligence {
  overallGrade: string | null;           // e.g. "B+"
  score: number | null;                  // e.g. 72
  categoryScores: Record<string, number>;
  categoryGrades: Record<string, string>;
  weaknesses: string[];
  priorities: string[];
  strengths: string[];
  competitiveEdge: string | null;
  rawData: Record<string, unknown> | null;
}

export interface ScoutIntelligence {
  marketPosition: string | null;
  competitors: Array<{
    name: string;
    threatLevel?: string;
    strengths?: string[];
    weaknesses?: string[];
  }>;
  opportunities: string[];
  threats: string[];
  quickWins: string[];
  rawData: Record<string, unknown> | null;
}

export interface GrowthIntelligence {
  available: boolean;
  compete: CompeteIntelligence | null;
  scout: ScoutIntelligence | null;
  lastUpdatedAt: string | null;
}

function extractArray(data: unknown, keys: string[]): string[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  }
  return [];
}

function extractString(
  data: unknown,
  keys: string[],
): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}

function normalizeCompete(
  raw: Record<string, unknown> | null,
): CompeteIntelligence {
  if (!raw) {
    return {
      overallGrade: null,
      score: null,
      categoryScores: {},
      categoryGrades: {},
      weaknesses: [],
      priorities: [],
      strengths: [],
      competitiveEdge: null,
      rawData: null,
    };
  }
  const score =
    typeof raw.score === "number"
      ? raw.score
      : typeof raw.overallScore === "number"
        ? raw.overallScore
        : null;
  const grade = extractString(raw, ["grade", "overallGrade", "letter_grade"]);
  const categoryScores =
    raw.categoryScores && typeof raw.categoryScores === "object"
      ? (raw.categoryScores as Record<string, number>)
      : {};
  const categoryGrades =
    raw.categoryGrades && typeof raw.categoryGrades === "object"
      ? (raw.categoryGrades as Record<string, string>)
      : {};
  return {
    overallGrade: grade,
    score,
    categoryScores,
    categoryGrades,
    weaknesses: extractArray(raw, ["weaknesses", "issues", "problems"]),
    priorities: extractArray(raw, [
      "priorities",
      "topPriorities",
      "recommendations",
      "prioritizedActions",
    ]),
    strengths: extractArray(raw, ["strengths", "advantages"]),
    competitiveEdge: extractString(raw, [
      "competitiveEdge",
      "competitive_edge",
      "uniqueStrength",
    ]),
    rawData: raw,
  };
}

function normalizeScout(
  raw: Record<string, unknown> | null,
): ScoutIntelligence {
  if (!raw) {
    return {
      marketPosition: null,
      competitors: [],
      opportunities: [],
      threats: [],
      quickWins: [],
      rawData: null,
    };
  }
  const competitorsRaw = raw.competitors;
  const competitors = Array.isArray(competitorsRaw)
    ? competitorsRaw.map((c: unknown) => {
        if (typeof c === "string") return { name: c };
        if (c && typeof c === "object") {
          const obj = c as Record<string, unknown>;
          return {
            name: String(obj.name || obj.businessName || "Unknown"),
            threatLevel:
              typeof obj.threatLevel === "string"
                ? obj.threatLevel
                : undefined,
            strengths: Array.isArray(obj.strengths)
              ? (obj.strengths as string[])
              : undefined,
            weaknesses: Array.isArray(obj.weaknesses)
              ? (obj.weaknesses as string[])
              : undefined,
          };
        }
        return { name: "Unknown" };
      })
    : [];
  return {
    marketPosition: extractString(raw, [
      "marketPosition",
      "market_position",
      "position",
    ]),
    competitors,
    opportunities: extractArray(raw, ["opportunities"]),
    threats: extractArray(raw, ["threats"]),
    quickWins: extractArray(raw, ["quickWins", "quick_wins", "quickOpportunities"]),
    rawData: raw,
  };
}

/**
 * Fetch COMPETE + SCOUT results for a business and normalize them
 * into a unified GrowthIntelligence object for use by execution systems.
 *
 * Returns cached DB results — does NOT trigger new AI generation.
 * If results don't exist yet, returns { available: false }.
 */
export async function getGrowthIntelligence(
  businessId: string,
): Promise<GrowthIntelligence> {
  const { data: rows } = await supabase
    .from("strategy_outputs")
    .select("step_number, output_data, created_at")
    .eq("business_id", businessId)
    .in("step_number", [3, 4])
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) {
    return { available: false, compete: null, scout: null, lastUpdatedAt: null };
  }

  const competeRow = rows.find((r) => r.step_number === 3);
  const scoutRow = rows.find((r) => r.step_number === 4);

  const compete = competeRow
    ? normalizeCompete(
        competeRow.output_data as Record<string, unknown> | null,
      )
    : null;
  const scout = scoutRow
    ? normalizeScout(scoutRow.output_data as Record<string, unknown> | null)
    : null;

  const lastUpdatedAt =
    [competeRow?.created_at, scoutRow?.created_at]
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

  return {
    available: !!(compete || scout),
    compete,
    scout,
    lastUpdatedAt: lastUpdatedAt as string | null,
  };
}
