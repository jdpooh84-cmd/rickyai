#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "Project discipline reminder:"
echo "- Read CLAUDE.md before major work."
echo "- Read CONTRACTS.md before changing routes, APIs, schemas, auth, billing, permissions, or deployment."
echo "- Read LESSONS.md before planning."
echo "- Use /preflight before building."
echo "- Use /self-improve before calling substantial work complete."
echo "- Use /reflect after mistakes or important changes."
echo ""
echo "RickyAI context:"
echo "- Supabase project: psmxeckstfeyxlqzzkgw"
echo "- CLI binary: C:\\Users\\jodan\\supabase-bin\\supabase.exe"
echo "- Active video pipeline: generate-video-v2 (not generate-video)"
echo "- All edge function imports must use npm: specifiers"

exit 0
