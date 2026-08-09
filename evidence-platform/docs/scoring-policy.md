# Scoring Policy

## Score Components (0–100 total before penalties)

| Component | Max Points | Description |
|---|---|---|
| Source integrity | 15 | Source is real, accessible, unretracted, identity verified |
| Source authority | 15 | Source tier (primary official, systematic review, company filing, quality journalism, discovery-only) |
| Direct entailment | 25 | Exact passage directly supports the precise claim (not merely topic-similar) |
| Independent corroboration | 10 | Additional independent sources also support the claim |
| Freshness | 10 | Source publication/update date is appropriate for the claim's time scope |
| Scope/jurisdiction/population fit | 10 | Source covers the specific geography, population, or time period claimed |
| Evidence completeness | 10 | No major gaps in the evidence trail for this claim |

## Penalties

| Penalty | Max Deduction | Trigger |
|---|---|---|
| Material contradiction | −20 | Credible current source contradicts the claim |
| Correction/retraction | −30 | Source has been retracted or materially corrected |
| Missing-context risk | −15 | Significant known context is absent that would change the verdict |

## Verdict Thresholds (after policy overrides)

| Score Range | Default Verdict |
|---|---|
| 80–100 | VERIFIED_ENOUGH_TO_ACT |
| 60–79 | PARTIALLY_SUPPORTED |
| 40–59 | MIXED_OR_UNCERTAIN |
| 20–39 | UNVERIFIABLE |
| 0–19 | UNVERIFIABLE |
| Any with credible contradiction | CONTRADICTED |

**Policy overrides outrank numeric score:**

a. Fabricated, unresolved, or materially mismatched source → cannot be `VERIFIED_ENOUGH_TO_ACT`
b. Retracted source used as support → verdict blocked until replaced
c. High-stakes claim with unknown critical context → `REQUIRES_QUALIFIED_REVIEW`
d. Credible current contradiction present → cannot be `VERIFIED_ENOUGH_TO_ACT`
e. Unknown legal jurisdiction → no legal conclusion possible
f. Metadata-only inaccessible source as sole support for high-stakes claim → cannot be `VERIFIED_ENOUGH_TO_ACT`
g. Missing audit event, source identity, or policy result → final verdict blocked

## Source Tier Values

| Tier | Examples | Max Authority Points |
|---|---|---|
| 1 — Primary official evidence | Government statistics, peer-reviewed original studies, official filings | 15 |
| 2 — Systematic reviews | Meta-analyses, Cochrane reviews, recognized bodies | 13 |
| 3 — Official documentation | Company filings, official policy documents | 10 |
| 4 — Quality journalism | Major outlets, verified reporting for event context only | 6 |
| 5 — Discovery-only | Blogs, social, forums, marketing, AI answers | 2 |

Tier 5 sources cannot be final evidence when a higher-tier source is reasonably available.

## Scoring Implementation

The scoring engine is implemented as pure TypeScript in `lib/verification/scoring-engine.ts`.
It consumes structured evidence objects. It does not call an LLM.
All score components and overrides are stored in `claim_scores` with full JSON explanation.
Score version is stored to enable historical comparison when policy changes.
