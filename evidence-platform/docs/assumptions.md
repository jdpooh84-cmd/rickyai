# Assumptions

Decisions made without explicit founder input, per the autonomous build directive.

| # | Assumption | Rationale |
|---|---|---|
| 1 | Project built in `evidence-platform/` subdirectory of `jdpooh84-cmd/rickyai` repo, not a separate repository | No tool available to create a new GitHub repo; subdirectory avoids destroying existing Ricky AI codebase |
| 2 | Anthropic Claude 3.5 Sonnet is the default model for claim extraction, evidence matching, and prosecutor review | Most capable production model available at build time; model ID is a versioned config constant |
| 3 | Mock AI provider is the default when `ANTHROPIC_API_KEY` is absent | Enables local development and CI without real API costs |
| 4 | File size limit is 15 MB as specified | Files larger than this are rejected at intake |
| 5 | Allowed upload MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, text/markdown | Covers PDF, DOCX, TXT, Markdown as required |
| 6 | PDF parsing uses pdf-parse (Node.js); DOCX parsing uses mammoth | Both are pure-JS, no native dependencies |
| 7 | URL fetcher blocks RFC-1918 ranges plus link-local and loopback | Standard SSRF defense |
| 8 | Crossref API is queried without authentication (rate-limited public tier) | No Crossref Polite Pool key available; acceptable for MVP |
| 9 | DataCite REST API is queried without authentication | Public API, acceptable for MVP |
| 10 | Organization plan is a string enum; billing integration is deferred | MVP focuses on verification logic, not subscription management |
| 11 | Admin role is organization-scoped (`profiles.role = 'admin'`), not a global superuser | Simplest safe default; global admin deferred |
| 12 | Benchmark lab access requires `role = 'admin'` within the organization | Consistent with organization-scoped access model |
| 13 | No PDF export in MVP report output | Directive explicitly excludes PDF dependency |
| 14 | Rate limiting uses an in-memory sliding window per IP | Acceptable for MVP; production would use Redis or Upstash |
| 15 | `updated_at` triggers are created via PostgreSQL function, applied to each table | Standard Supabase pattern |
| 16 | Storage bucket name defaults to `case-artifacts` (configurable via `ARTIFACT_STORAGE_BUCKET`) | Reasonable default |
| 17 | Commitment accountability does not infer legal liability, motive, or intent | Explicitly stated in product rules |
| 18 | Finance, health, law, government, media provenance, and identity/scam domain policy packs are placeholder stubs only | Directive specifies future placeholders |
| 19 | Single-provider adversarial review is labeled `SINGLE_PROVIDER` with reduced confidence | Directive requirement when only one LLM is configured |
| 20 | shadcn/ui components are manually installed (shadcn CLI requires remote fetch blocked by proxy) | Proxy blocks `ui.shadcn.com`; components installed via direct `@radix-ui` packages |
