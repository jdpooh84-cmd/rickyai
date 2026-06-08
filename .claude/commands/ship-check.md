Use the production-engineering-security-reviewer skill.

Decide whether the current work is ready to ship.

Follow this exactly:

1. Read CLAUDE.md, CONTRACTS.md, LESSONS.md, and docs/build-review.md.
2. Inspect git diff and changed files.
3. Check for:
   - broken functionality
   - security risks
   - auth or permission regressions
   - database/schema risks
   - billing risks
   - deployment risks
   - missing tests
   - missing validation
   - missing error handling
   - performance problems
4. Run or recommend:
   - /diff
   - /code-review max
   - /security-review
   - /verify
5. Grade the work:
   - Ready to ship
   - Almost ready
   - Not ready
6. If not ready, list exact blockers.
7. If ready, produce a final shipping summary:
   - what changed
   - why it is safe
   - checks passed
   - risks remaining
   - rollback notes
