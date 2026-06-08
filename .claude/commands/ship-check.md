Decide whether the current work is ready to ship.

Follow this exactly:

1. Read CLAUDE.md, CONTRACTS.md, LESSONS.md, and docs/build-review.md.
2. Inspect git diff.
3. Run or verify:
   - build
   - lint
   - typecheck
   - tests
   - contract check
   - security review if sensitive areas changed

4. Grade the work:
   - Ready to ship
   - Almost ready
   - Not ready

5. If not ready, list the exact blockers.

6. If ready, produce a final shipping summary:
   - what changed
   - why it is safe
   - checks passed
   - risks remaining
   - rollback notes
