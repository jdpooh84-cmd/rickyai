Check whether the current changes broke protected contracts.

Follow this exactly:

1. Read CONTRACTS.md.
2. Inspect git diff and recently changed files.
3. Identify any change touching:
   - routes
   - APIs
   - database schemas
   - auth
   - billing
   - permissions
   - file storage
   - environment variables
   - deployment
   - webhook behavior

4. For each possible contract impact, report:
   - contract touched
   - file changed
   - risk level
   - whether approval is required
   - whether tests/checks exist

5. If a protected contract changed without explicit user approval, stop and recommend reverting or getting approval.

6. Save findings to docs/build-review.md.
