# API Reference

All routes are Next.js Route Handlers. All authenticated routes require a valid Supabase session cookie. All request/response bodies are JSON.

## Health

### GET /api/health
Returns service status. No authentication required.

**Response 200:**
```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z", "version": "0.1.0" }
```

## Cases

### POST /api/cases
Create a new verification case. Enqueues pipeline job.

**Request body (Zod-validated):**
```json
{
  "title": "string (required)",
  "input_type": "text | url | doi_list | file_upload",
  "raw_input": "string (for text/url/doi_list)",
  "user_context": "object (optional metadata)"
}
```

**Response 201:**
```json
{ "id": "uuid", "status": "queued" }
```

**Errors:** 400 (validation), 401 (not authenticated), 429 (rate limited)

---

### GET /api/cases
List cases for the authenticated organization.

**Query params:** `?page=1&limit=20&status=completed`

**Response 200:**
```json
{ "cases": [...], "total": 42 }
```

---

### GET /api/cases/:id
Get case detail including claims, scores, and report.

**Response 200:** Full case object with embedded claims and scores.

**Errors:** 401, 403 (wrong org), 404

---

### POST /api/cases/:id/run
Retry a failed case or re-run from a specific stage.

**Request body:**
```json
{ "from_stage": "claims_extracted" }
```

---

### GET /api/cases/:id/claims
List all claims for a case with evidence and scores.

---

## Commitments

### POST /api/commitments
Store a new commitment.

**Request body:**
```json
{
  "subject_name": "string",
  "commitment_text": "string",
  "commitment_type": "promise | policy | projection | other",
  "made_at": "ISO date string",
  "scope": { "geography": "...", "population": "..." }
}
```

---

### GET /api/commitments
List commitments for the organization.

---

### POST /api/commitments/:id/evaluate
Evaluate a commitment against later evidence.

**Request body:**
```json
{
  "evidence_text": "string",
  "evidence_source_url": "string (optional)"
}
```

**Response 200:**
```json
{
  "verdict": "CONSISTENT | PARTIALLY_CONSISTENT | CONTRADICTED | NOT_EVALUABLE",
  "explanation": "string",
  "supporting_evidence": [...],
  "contradicting_evidence": [...]
}
```

---

## Benchmarks (Admin only)

### POST /api/benchmarks/run
Run the full benchmark suite or a specific case.

**Request body:**
```json
{ "benchmark_slug": "string (optional — omit to run all)" }
```

---

### GET /api/benchmarks/results
List benchmark results, optionally filtered by provider/model/date.

---

## Error Response Format

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_CODE",
  "details": {}
}
```

## Rate Limits

Default: 50 requests per minute per IP. Configurable via `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`.
