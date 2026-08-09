import { scoreEvidence, SCORE_VERSION } from "@/lib/verification/scoring-engine";
import { BENCHMARK_FIXTURES, type BenchmarkFixture } from "./fixtures";

export interface FixtureResult {
  id: string;
  description: string;
  category: string;
  expected_verdict: string;
  actual_verdict: string;
  expected_score_min: number;
  expected_score_max: number;
  actual_score: number;
  verdict_pass: boolean;
  score_pass: boolean;
  pass: boolean;
  components: Record<string, number>;
  policy_overrides_applied: string[];
}

export interface GateResults {
  strong_support_100pct: boolean;
  retraction_override_100pct: boolean;
  contradiction_override_100pct: boolean;
  audit_trail_override_100pct: boolean;
  high_stakes_override_100pct: boolean;
}

export interface BenchmarkRunResult {
  score_version: string;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  all_gates_pass: boolean;
  gate_results: GateResults;
  details: FixtureResult[];
}

function runFixture(fixture: BenchmarkFixture): FixtureResult {
  const result = scoreEvidence(fixture.input);
  const actual_verdict = result.verdict;
  const actual_score = result.components.total_score;

  const verdict_pass = actual_verdict === fixture.expected_verdict;
  const score_pass =
    actual_score >= fixture.expected_score_min && actual_score <= fixture.expected_score_max;
  const pass = verdict_pass && score_pass;

  const policy_overrides_applied = result.policy_overrides
    .filter((o) => o.applied)
    .map((o) => o.rule);

  return {
    id: fixture.id,
    description: fixture.description,
    category: fixture.category,
    expected_verdict: fixture.expected_verdict,
    actual_verdict,
    expected_score_min: fixture.expected_score_min,
    expected_score_max: fixture.expected_score_max,
    actual_score,
    verdict_pass,
    score_pass,
    pass,
    components: result.components as unknown as Record<string, number>,
    policy_overrides_applied,
  };
}

function checkGate(details: FixtureResult[], categories: string[]): boolean {
  const relevant = details.filter((d) => categories.includes(d.category));
  return relevant.length > 0 && relevant.every((d) => d.pass);
}

export function runBenchmarks(): BenchmarkRunResult {
  const details = BENCHMARK_FIXTURES.map(runFixture);
  const passed = details.filter((d) => d.pass).length;
  const failed = details.filter((d) => !d.pass).length;
  const total = details.length;

  const gate_results: GateResults = {
    strong_support_100pct: checkGate(details, ["strong_support"]),
    retraction_override_100pct: checkGate(details, ["retraction_override"]),
    contradiction_override_100pct: checkGate(details, ["contradiction_override"]),
    audit_trail_override_100pct: checkGate(details, ["audit_trail_override"]),
    high_stakes_override_100pct: checkGate(details, ["high_stakes_override"]),
  };

  const all_gates_pass = Object.values(gate_results).every(Boolean);

  return {
    score_version: SCORE_VERSION,
    total,
    passed,
    failed,
    pass_rate: total > 0 ? passed / total : 0,
    all_gates_pass,
    gate_results,
    details,
  };
}
