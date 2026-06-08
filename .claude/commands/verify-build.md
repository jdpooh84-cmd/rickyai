Use the production-engineering-security-reviewer skill.

Verify that the current build actually works.

Follow this workflow:

1. Inspect package scripts, README, and project docs.
2. Identify available checks:
   - install
   - lint
   - typecheck
   - test
   - build
   - e2e
   - start/dev server
3. Run safe available checks.
4. If the project does not have a known run recipe, recommend /run-skill-generator.
5. If the app can run, use /run or /verify behavior:
   - launch the app
   - confirm the change works in runtime
   - inspect visible failures
   - report runtime issues
6. If checks fail, identify the root cause and fix when enough context exists.
7. End with:
   - Commands run
   - Passed checks
   - Failed checks
   - Runtime result
   - Remaining blockers

For RickyAI specifically:
- Build: npm run build
- Edge function smoke test: POST to https://psmxeckstfeyxlqzzkgw.supabase.co/functions/v1/<name>
- Stripe flows: node verify-portal.mjs
