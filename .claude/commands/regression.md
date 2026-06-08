Run a regression check against the current project.

Follow this exactly:

1. Read package scripts and project docs.
2. Identify available checks:
   - lint
   - typecheck
   - test
   - build
   - e2e
   - format
   - security review

3. Run the safest relevant checks.
4. If checks fail:
   - identify root cause
   - fix the failure
   - re-run the failing check
   - do not hide or ignore failures

5. Inspect git diff for accidental changes.

6. Update docs/build-review.md with:
   - commands run
   - pass/fail result
   - failures found
   - fixes applied
   - remaining risks
