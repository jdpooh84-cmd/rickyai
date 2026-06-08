Use the production-engineering-security-reviewer skill.

Run an elite production engineering and security review on the current codebase state.

Follow this exact workflow:

1. Inspect current git diff.
2. Read relevant files before making claims.
3. Identify correctness bugs, weak logic, security vulnerabilities, architectural problems, performance issues, and maintainability risks.
4. Explain root causes concisely.
5. Apply safe fixes directly when enough context exists.
6. Run or recommend the strongest available checks.
7. Re-check the improved result.
8. End with:
   - Issues found
   - Why they matter
   - Improved solution
   - Re-check
   - Additional hardening

Use these Claude Code commands when appropriate:
- /diff
- /code-review high --fix
- /security-review
- /simplify
- /verify

Do not make cosmetic-only changes.
Do not claim checks passed unless they actually ran.
Do not expose or print secrets.
