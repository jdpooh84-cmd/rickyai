import { describe, it, expect } from "vitest";
import { classifyDomain } from "@/lib/verification/classifier";

describe("classifyDomain", () => {
  it("classifies health content as high-stakes", () => {
    const result = classifyDomain("The patient diagnosis showed cancer requiring treatment and medication.");
    expect(result.domain).toBe("health_medicine");
    expect(result.stakes_level).toBe("high");
  });

  it("classifies legal content as high-stakes", () => {
    const result = classifyDomain("The court ruling on regulation and compliance liability is final.");
    expect(result.domain).toBe("legal_regulatory");
    expect(result.stakes_level).toBe("high");
  });

  it("classifies academic content as medium-stakes", () => {
    const result = classifyDomain("The peer-reviewed study from the journal showed research findings.");
    expect(result.domain).toBe("academic_evidence");
    expect(result.stakes_level).toBe("medium");
  });

  it("defaults to general_research when no keywords match", () => {
    const result = classifyDomain("the quick brown fox jumps over the lazy dog");
    expect(result.domain).toBe("general_research");
    expect(result.stakes_level).toBe("medium");
  });

  it("returns required fields", () => {
    const result = classifyDomain("some text");
    expect(result).toHaveProperty("domain");
    expect(result).toHaveProperty("stakes_level");
    expect(result).toHaveProperty("materiality");
    expect(result).toHaveProperty("policy_pack");
    expect(result).toHaveProperty("reasoning");
  });

  it("classifies financial content as high-stakes", () => {
    const result = classifyDomain("The investment return forecast for the stock market portfolio");
    expect(result.domain).toBe("financial");
    expect(result.stakes_level).toBe("high");
  });
});
