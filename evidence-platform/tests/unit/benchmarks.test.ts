import { describe, it, expect } from "vitest";
import { runBenchmarks } from "@/lib/benchmarks/runner";
import { BENCHMARK_FIXTURES } from "@/lib/benchmarks/fixtures";

describe("benchmark runner", () => {
  it("runs all 15 fixtures without throwing", () => {
    const result = runBenchmarks();
    expect(result.total).toBe(BENCHMARK_FIXTURES.length);
    expect(result.total).toBe(15);
  });

  it("passes all 5 release gates", () => {
    const result = runBenchmarks();
    expect(result.gate_results.strong_support_100pct).toBe(true);
    expect(result.gate_results.retraction_override_100pct).toBe(true);
    expect(result.gate_results.contradiction_override_100pct).toBe(true);
    expect(result.gate_results.audit_trail_override_100pct).toBe(true);
    expect(result.gate_results.high_stakes_override_100pct).toBe(true);
    expect(result.all_gates_pass).toBe(true);
  });

  it("has score_version from scoring engine", () => {
    const result = runBenchmarks();
    expect(result.score_version).toBe("1.0.0");
  });

  it("B003 retracted source → CONTRADICTED", () => {
    const result = runBenchmarks();
    const b003 = result.details.find((d) => d.id === "B003");
    expect(b003).toBeDefined();
    expect(b003!.actual_verdict).toBe("CONTRADICTED");
    expect(b003!.pass).toBe(true);
  });

  it("B007 missing audit trail → UNVERIFIABLE", () => {
    const result = runBenchmarks();
    const b007 = result.details.find((d) => d.id === "B007");
    expect(b007).toBeDefined();
    expect(b007!.actual_verdict).toBe("UNVERIFIABLE");
    expect(b007!.pass).toBe(true);
  });

  it("B011 fabricated citation → UNVERIFIABLE", () => {
    const result = runBenchmarks();
    const b011 = result.details.find((d) => d.id === "B011");
    expect(b011).toBeDefined();
    expect(b011!.actual_verdict).toBe("UNVERIFIABLE");
    expect(b011!.pass).toBe(true);
  });

  it("B001 strong tier-1 support → VERIFIED_ENOUGH_TO_ACT with score ≥ 80", () => {
    const result = runBenchmarks();
    const b001 = result.details.find((d) => d.id === "B001");
    expect(b001).toBeDefined();
    expect(b001!.actual_verdict).toBe("VERIFIED_ENOUGH_TO_ACT");
    expect(b001!.actual_score).toBeGreaterThanOrEqual(80);
    expect(b001!.pass).toBe(true);
  });

  it("B010 no evidence → UNVERIFIABLE with score = 0", () => {
    const result = runBenchmarks();
    const b010 = result.details.find((d) => d.id === "B010");
    expect(b010).toBeDefined();
    expect(b010!.actual_verdict).toBe("UNVERIFIABLE");
    expect(b010!.actual_score).toBe(0);
    expect(b010!.pass).toBe(true);
  });

  it("pass rate is at least 90% across all fixtures", () => {
    const result = runBenchmarks();
    expect(result.pass_rate).toBeGreaterThanOrEqual(0.9);
  });
});
