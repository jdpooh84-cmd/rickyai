export const PROMPT_VERSIONS = {
  claimExtraction: "claim-extraction-v1",
  domainClassifier: "domain-classifier-v1",
  evidenceMatcher: "evidence-matcher-v1",
  prosecutor: "prosecutor-v1",
  commitmentEvaluation: "commitment-evaluation-v1",
  reportGenerator: "report-generator-v1",
} as const;

export type PromptVersionKey = keyof typeof PROMPT_VERSIONS;
