# Domain Policies

## Active Policy Packs (MVP)

### general_research
- Default pack for academic evidence, reports, and general factual claims.
- High-stakes triggers: none beyond global rules.
- Allows informational output for properly sourced claims.

### academic_evidence
- Applies to peer-reviewed research, meta-analyses, and scholarly citations.
- Requires DOI or publisher metadata for primary claims.
- Correlation-causation errors are flagged by the prosecutor.

### business_market_research
- Applies to market size claims, competitive data, financial projections, and business statistics.
- Source tier minimum: official filings or recognized research firms for market-size claims.
- Requires publication date and methodology disclosure when available.

### consumer_product_claims
- Applies to efficacy, safety, and comparative product claims.
- Regulatory or clinical backing required for safety claims.
- Marketing sources are tier 5 (discovery-only) for efficacy claims.

### technology_ai_claims
- Applies to claims about AI system performance, capabilities, benchmarks, and limitations.
- Benchmark claims require original paper with methodology.
- Vendor-published benchmarks are tier 3 at most without independent replication.

## Placeholder Stubs (Future Packs — NOT Active in MVP)

These domain packs are named but not implemented. Any claim matching them routes to `REQUIRES_QUALIFIED_REVIEW` until a policy pack is active.

| Pack | Trigger Keywords | Reason Deferred |
|---|---|---|
| finance | "investment", "securities", "returns", "portfolio", "trading" | Regulatory complexity; requires licensed review |
| health | "diagnosis", "treatment", "medication", "symptom", "cure" | Patient safety; requires clinical review |
| law | "legal", "lawsuit", "contract", "liability", "statute" | Jurisdiction variance; requires legal review |
| government | "regulation", "policy", "legislation", "compliance" | Complexity and jurisdiction variance |
| media_provenance | "deepfake", "manipulated", "authentic footage" | Requires specialized media forensics |
| identity_scam | "impersonation", "scam", "fraud", "phishing" | Requires identity verification infrastructure |

## Global High-Stakes Rules (All Domains)

If submitted content contains language involving any of the following, the system marks the case `high` stakes and routes any unresolved claim to `REQUIRES_QUALIFIED_REVIEW`:

- Explicit legal conclusions or liability assertions
- Diagnosis, treatment, or medication recommendations
- Investment, tax, or financial advice
- Safety-critical operational instructions
- Crisis or self-harm language (routed to qualified support resources, never to a model verdict)
- Claims about specific real individuals in potentially defamatory contexts

These global rules cannot be overridden by a domain policy pack.
