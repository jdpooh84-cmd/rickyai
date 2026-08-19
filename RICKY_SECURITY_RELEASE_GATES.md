# RICKY SECURITY RELEASE GATES

**Updated:** 2026-08-19

This document defines the minimum security state required before enabling each growth/GTM milestone.

---

## Gate 1 — BYO API Key Feature (current)

All must be ✅ before storing or using any user-provided API key:

- [x] B-01: Keys encrypted at rest with AES-256-GCM
- [x] B-01: Browser cannot read or write raw key material from DB
- [x] B-01: All edge function consumers decrypt via credential-service
- [ ] **OPERATOR**: `USER_API_KEY_ENCRYPTION_SECRET` set as Supabase secret
- [ ] **OPERATOR**: DB migration `20260819000001_api_key_encryption.sql` pushed
- [ ] **OPERATOR**: `save-api-key` edge function deployed

---

## Gate 2 — Production Webhook Endpoints

All must be ✅ before Creatomate/Klap callbacks handle production render results:

- [x] B-02: `video-callback` validates `CREATOMATE_WEBHOOK_SECRET` token
- [x] B-02: `clip-callback` validates `KLAP_WEBHOOK_SECRET` token
- [x] B-02: Duplicate callback idempotency via `webhook_receipts` table
- [ ] **OPERATOR**: `CREATOMATE_WEBHOOK_SECRET` set as Supabase secret
- [ ] **OPERATOR**: `KLAP_WEBHOOK_SECRET` set as Supabase secret
- [ ] **OPERATOR**: `CREATOMATE_WEBHOOK_URL` env var set to the full callback URL with `?secret=<token>`
- [ ] **OPERATOR**: DB migration `20260819000002_webhook_receipts.sql` pushed
- [ ] **OPERATOR**: `video-callback` and `clip-callback` deployed

---

## Gate 3 — GTM / Paid Subscriber Launch

All must be ✅ before any paid marketing spend or invitation to trial users:

- [x] All Phase 0 BLOCKER and CRITICAL items resolved
- [ ] H-01: Social platform "Connect" UI removed or accurately labeled
- [ ] H-02: Cross-user RLS test suite exists and passes
- [ ] H-03: CI pipeline (build + lint + test) on every PR
- [ ] H-04: Dead edge functions (`generate-video`, `create-template`, `debug-template`) undeployed
- [ ] H-05: Sentry (or equivalent) active on frontend and edge functions
- [ ] OPERATOR: All Gate 1 and Gate 2 operator actions complete

---

## Gate 4 — Multi-Tenant Scale / Agency Plan

All must be ✅ before enabling Agency tier ($799/mo) or multi-seat features:

- [x] Tenant isolation RLS in place (2026-06-09 migration)
- [ ] Verified by cross-user test suite (H-02)
- [ ] Admin audit log reviewed and retention policy set
- [ ] MFA or step-up auth for admin role management
- [ ] Storage bucket ACL audit (no cross-user object access)

---

## Checklist Legend

- [x] Implemented in code — verified in this branch
- [ ] **OPERATOR**: Requires human action (secret rotation, platform config, deployment)
- [ ] Not yet implemented
