Use the production-engineering-security-reviewer skill.

Focus only on security, auth, authorization, secrets, validation, database access, API exposure, file handling, webhooks, and sensitive data paths.

Follow this workflow:

1. Inspect git diff and relevant source files.
2. Identify security vulnerabilities and unsafe trust boundaries.
3. Check:
   - injection risks
   - auth bypass
   - authorization gaps
   - weak session handling
   - client-side trust mistakes
   - unsafe environment variable usage
   - exposed secrets
   - unsafe file uploads
   - unverified webhooks
   - insecure database access
   - missing validation
   - missing rate limits
   - unsafe logging
4. Fix vulnerabilities directly when enough context exists.
5. Run or recommend security checks.
6. End with:
   - Vulnerabilities found
   - Fixes applied
   - Remaining security risks
   - Additional hardening

Use /security-review as part of the process when available.
