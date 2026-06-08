# Claude Build Discipline — RickyAI

## Mission

You are building production-ready software, not demos.

You are not allowed to stop at "working enough." Every meaningful build, refactor, feature, fix, or architecture change must follow this loop:

1. Understand the existing system before editing.
2. Identify protected contracts before changing code.
3. Make the smallest safe change that solves the real problem.
4. Run the relevant checks.
5. Critique the work harshly.
6. Replace weak, brittle, duplicated, unclear, or unsafe code.
7. Document what changed.
8. Save durable lessons so the same mistake is less likely next time.

## Non-Negotiable Standards

- Never break existing routes, APIs, database tables, auth flows, billing flows, or user data contracts without explicit approval.
- Never remove working functionality to make implementation easier.
- Never invent files, commands, dependencies, schemas, or environment variables without checking the repo first.
- Never claim something is fixed unless the code was actually changed and checked.
- Never leave TODOs instead of implementation unless explicitly approved.
- Never expose, print, commit, or hardcode API keys, secrets, tokens, private credentials, or `.env` contents.
- Prefer boring, durable, maintainable code over clever code.
- Prefer clear names over short names.
- Prefer explicit error handling over silent failure.
- Prefer small modules over giant files.
- Prefer tests and checks over confidence.

## Required Before Any Major Change

Before editing, inspect:

- `CONTRACTS.md`
- `LESSONS.md`
- relevant source files
- package scripts
- existing patterns
- current routes, schemas, types, and interfaces

Then state:

- what you are changing
- what you are not changing
- what contracts must remain untouched
- what checks will prove the change worked

## Required After Any Major Change

After editing, run the strongest available checks:

- `npm run build` (always)
- `npm run typecheck` (if available)
- `npm run lint` (if available)
- security-sensitive review if auth, payments, files, secrets, user data, or permissions changed

If a command is unavailable, explain what was missing and use the closest available check.

## Harsh Self-Review Rule

At the end of substantial work, write or update `docs/build-review.md` with:

- What worked
- What failed
- What was weak
- What was replaced
- What risks remain
- What checks were run
- What should be remembered next time

## Learning Rule

When the same mistake, weakness, or pattern appears twice:

- Add a short durable rule to `LESSONS.md`
- Add a permanent project rule to `CLAUDE.md` only if it applies to every future build
- Add protected interfaces or invariants to `CONTRACTS.md` if breaking them would damage the app

## Contract Rule

Before changing public behavior, read `CONTRACTS.md`.

If the change touches a protected contract, stop and ask for approval unless the user explicitly requested that contract change.

Protected contracts include:

- public routes
- API response shapes
- database schemas
- auth behavior
- billing behavior
- role permissions
- file storage paths
- environment variables
- webhook payloads
- production deployment commands

## Final Response Rule

When done, always report:

- files changed
- checks run
- errors found
- errors fixed
- remaining risks
- whether `LESSONS.md`, `CONTRACTS.md`, or `docs/build-review.md` was updated

## Required Claude Code Slash Command Workflow

For serious code work, use the production-engineering-security-reviewer skill and follow this workflow:

### Before Editing
```
/plan
/diff
/context
```

### During Review and Fixing
```
/elite-review
/code-review high --fix
/simplify
/security-review
```

### For Security-Sensitive Changes
```
/secure-fix
/security-review
```
Security-sensitive means auth, authorization, billing, user data, database rules, file uploads, secrets, webhooks, API keys, permissions, or deployment configuration.

### For Runtime Proof
```
/run-skill-generator
/run
/verify
/verify-build
```

### Before Shipping
```
/ship-check
/code-review max
/security-review
/diff
```

### If Work Goes Wrong
```
/rewind
/debug
/doctor
```

### For Long Sessions
```
/context
/compact
```

Never claim production readiness unless review, security, diff inspection, and available verification steps have been completed or explicitly reported as unavailable.

---

## Project-Specific Rules

- Supabase CLI binary is at `C:\Users\jodan\supabase-bin\supabase.exe` — always use this, not `npx supabase`
- Deploy edge functions with: `& "C:\Users\jodan\supabase-bin\supabase.exe" functions deploy <name> --project-ref psmxeckstfeyxlqzzkgw`
- The live Supabase project ref is `psmxeckstfeyxlqzzkgw` — the old ref `symbyrtzimafpxbzurjh` in the master prompt was wrong
- Frontend is deployed on Netlify at `lighthearted-crostata-834a8e.netlify.app`
- All edge function imports must use `npm:` specifiers (not `esm.sh`) to avoid cold-start EarlyDrop
- Always verify Stripe price IDs against `acct_1TEumfRUytwslneZ` before hardcoding; price IDs are account-scoped
- The active video pipeline is `generate-video-v2` — `generate-video` is the old function and must not be called by new frontend code
