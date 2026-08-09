import "server-only";

export interface DomainClassification {
  domain: string;
  stakes_level: "low" | "medium" | "high";
  materiality: "low" | "medium" | "high";
  policy_pack: string;
  reasoning: string;
}

// Keyword-based domain classifier — deterministic, no LLM calls.
// Used to assign stakes_level and pick a policy pack without AI risk.

const DOMAIN_RULES: Array<{
  domain: string;
  policy_pack: string;
  keywords: string[];
  stakes: "low" | "medium" | "high";
}> = [
  {
    domain: "health_medicine",
    policy_pack: "health_medicine",
    stakes: "high",
    keywords: [
      "treatment", "diagnosis", "medicine", "drug", "clinical", "patient",
      "symptom", "disease", "cancer", "therapy", "dosage", "medication",
      "hospital", "surgery", "vaccine", "medical", "health", "pharmaceutical",
    ],
  },
  {
    domain: "legal_regulatory",
    policy_pack: "legal_regulatory",
    stakes: "high",
    keywords: [
      "law", "legal", "court", "regulation", "statute", "compliance",
      "liability", "contract", "criminal", "civil", "judge", "attorney",
      "legislation", "policy", "ordinance", "enforcement",
    ],
  },
  {
    domain: "financial",
    policy_pack: "financial",
    stakes: "high",
    keywords: [
      "investment", "stock", "fund", "return", "profit", "loss", "revenue",
      "market", "financial", "banking", "loan", "interest", "dividend",
      "portfolio", "securities", "earnings", "forecast",
    ],
  },
  {
    domain: "academic_evidence",
    policy_pack: "academic_evidence",
    stakes: "medium",
    keywords: [
      "study", "research", "peer-reviewed", "journal", "meta-analysis",
      "randomized", "systematic review", "cohort", "findings", "data",
      "doi", "citation", "published", "university", "institute",
    ],
  },
  {
    domain: "business_market_research",
    policy_pack: "business_market_research",
    stakes: "medium",
    keywords: [
      "market share", "growth rate", "industry", "company", "enterprise",
      "sales", "customer", "survey", "analyst", "report", "quarter",
      "competitor", "strategy", "segment",
    ],
  },
  {
    domain: "technology_ai_claims",
    policy_pack: "technology_ai_claims",
    stakes: "medium",
    keywords: [
      "ai", "artificial intelligence", "machine learning", "model", "algorithm",
      "neural", "benchmark", "accuracy", "performance", "software", "platform",
      "api", "dataset", "training", "inference",
    ],
  },
  {
    domain: "consumer_product_claims",
    policy_pack: "consumer_product_claims",
    stakes: "low",
    keywords: [
      "product", "review", "feature", "price", "buy", "purchase", "quality",
      "warranty", "specification", "brand", "consumer", "retail",
    ],
  },
];

function scoreText(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

function inferMateriality(stakes: "low" | "medium" | "high"): "low" | "medium" | "high" {
  return stakes;
}

export function classifyDomain(text: string): DomainClassification {
  const scores = DOMAIN_RULES.map((rule) => ({
    rule,
    score: scoreText(text, rule.keywords),
  }));

  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];

  // If no keywords matched, default to general research
  if (!best || best.score === 0) {
    return {
      domain: "general_research",
      stakes_level: "medium",
      materiality: "medium",
      policy_pack: "general_research",
      reasoning: "No domain-specific keywords detected; defaulting to general research.",
    };
  }

  const { rule } = best;

  return {
    domain: rule.domain,
    stakes_level: rule.stakes,
    materiality: inferMateriality(rule.stakes),
    policy_pack: rule.policy_pack,
    reasoning: `Matched ${best.score} keyword(s) for domain "${rule.domain}".`,
  };
}
