#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
REVIEW_FILE="$PROJECT_DIR/docs/build-review.md"
mkdir -p "$PROJECT_DIR/docs"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")

cat >> "$REVIEW_FILE" <<EOF

## Stop Reminder — $TIMESTAMP

Before final answer, confirm:
- Files changed
- Checks run (npm run build, typecheck, lint)
- Bugs found
- Bugs fixed
- Remaining risks
- Lessons saved to LESSONS.md
- Contracts preserved per CONTRACTS.md

EOF

echo "Self-review reminder written to docs/build-review.md"

exit 0
