Use the production-engineering-security-reviewer skill.

Run a full self-improvement cycle on the current project state.

Follow this workflow exactly:

1. Inspect the current state.
   - Read git diff if available.
   - Read recently changed files.
   - Read CLAUDE.md, CONTRACTS.md, LESSONS.md.
   - Identify what changed this session.

2. Run available checks.
   Use the strongest available project commands:
   - npm run build
   - npm run typecheck (if available)
   - npm run lint (if available)
   - security review if auth, billing, permissions, secrets, uploads, webhooks, or user data changed

3. Write a harsh critique to docs/build-review.md:
   - What worked
   - What failed
   - What is weak
   - What is brittle
   - What is unclear
   - What is overcomplicated
   - What contracts are at risk
   - What needs replacement

4. Improve the build immediately.
   - Refactor weak code
   - Replace brittle patterns
   - Remove duplication
   - Improve naming, error handling, validation, file structure
   - Do not remove working features to make the task easier

5. Re-run checks.
   If checks fail, fix the failure.
   If checks cannot run, explain why and record in docs/build-review.md.

6. Re-review the improved version.
   Append to docs/build-review.md:
   - Fixes applied
   - Why the new version is stronger
   - Remaining risks
   - Checks run / passed / failed

7. Persist learning.
   - Add repeated mistakes to LESSONS.md.
   - Add permanent project rules to CLAUDE.md only if they apply to all future work.
   - Add protected contracts to CONTRACTS.md if breaking them would damage the app.

8. Final response must include:
   - files changed
   - checks run
   - bugs found and fixed
   - remaining risks
   - whether CLAUDE.md, CONTRACTS.md, LESSONS.md, or docs/build-review.md changed

Use these Claude Code commands when appropriate:
- /diff
- /code-review high --fix
- /simplify
- /security-review
- /verify

Never leave the improved result only in chat.
