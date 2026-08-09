# Benchmark Policy

## Purpose

The benchmark lab validates that the pipeline correctly handles known-bad inputs. All release gates must pass before the platform can be described as "controlled MVP-ready."

## Release Gates (must all be 100%)

1. Rejection of all controlled invented DOI benchmark cases.
2. Flagging of all controlled materially mismatched DOI/citation pairs.
3. Refusal to create APA references from unverified metadata.
4. Escalation of all configured unresolved high-stakes cases to REQUIRES_QUALIFIED_REVIEW.
5. All final claim verdicts have an audit trace and a policy result stored.

## Benchmark Fixture Catalog

| Slug | Category | Ground Truth |
|---|---|---|
| invented-doi-plausible | DOI fabrication | DOI_NOT_FOUND_IN_CHECKED_REGISTRIES |
| single-char-mutated-doi | DOI mutation | DOI_NOT_FOUND_IN_CHECKED_REGISTRIES or DOI_DOES_NOT_RESOLVE |
| real-doi-false-title | Citation mismatch | REAL_DOI_MISMATCHED_CITATION |
| real-doi-wrong-author-year | Citation mismatch | REAL_DOI_MISMATCHED_CITATION |
| real-source-unsupported-claim | Entailment failure | claim_evidence.relationship = irrelevant or cannot_verify |
| correlation-as-causation | Reasoning error | prosecutor flags causation_error |
| narrow-sample-global-claim | Scope error | scope_fit score reduced; prosecutor flags |
| wrong-jurisdiction | Jurisdiction error | REQUIRES_QUALIFIED_REVIEW or UNVERIFIABLE |
| outdated-claim-as-current | Freshness error | freshness score reduced; prosecutor flags stale_source |
| retracted-source | Retraction | retraction_penalty applied; verdict blocked |
| search-snippet-as-evidence | Source quality | source tier 5; cannot be sole high-stakes support |
| invented-quote-page | Fabricated passage | passage_id = null; DOI flags UNVERIFIED_TOOLS_OR_ACCESS_INSUFFICIENT |
| conflicting-credible-sources | Contradiction | MIXED_OR_UNCERTAIN or CONTRADICTED |
| multi-model-false-agreement | Model echo | prosecutor labels SINGLE_PROVIDER; score not inflated by agreement |
| commitment-contradicted | Accountability | commitment verdict = CONTRADICTED |

## Benchmark Result Schema

Each result records:
- benchmark_case_id
- model_provider and model_name
- pipeline_version (semver string)
- result (full structured output)
- passed (boolean)
- failure_types (array of strings if failed)
- created_at

## Running Benchmarks

Benchmarks are accessible to admin users only at `/benchmarks`.
API endpoint: `POST /api/benchmarks/run`
Results: `GET /api/benchmarks/results`

All controlled fixtures use mock data that does not make real network calls during CI.
Real DOI fixtures may make live Crossref/DataCite calls and should be tagged for network-enabled test environments.
