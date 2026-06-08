#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
mkdir -p "$PROJECT_DIR/docs"

REVIEW_FILE="$PROJECT_DIR/docs/build-review.md"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")

cat >> "$REVIEW_FILE" <<EOF

## Post-Edit Check — $TIMESTAMP

Before claiming completion, verify:
- Did this touch protected contracts in CONTRACTS.md?
- Did this introduce duplication?
- Did this weaken auth, billing, validation, or error handling?
- Did this require tests, lint, typecheck, or build?
- Did this create a durable lesson for LESSONS.md?
- Are edge function imports using npm: specifiers (not esm.sh)?

EOF

exit 0
