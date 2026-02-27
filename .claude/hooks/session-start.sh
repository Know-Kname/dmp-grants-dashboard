#!/bin/bash
# SessionStart hook — Detroit Memorial Park
# Runs on: startup | resume | clear | compact

set -euo pipefail

# Read session context from stdin
input=$(cat)
source=$(echo "$input" | jq -r '.source // "startup"')

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_FILE="$HOME/.claude/session-state.md"

# ── 1. Install dependencies (remote web sessions only) ─────────────────────
# npm install is expensive — only auto-run in remote/web environments where
# node_modules may not exist at session start. CLI has a persistent filesystem.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  cd "$PROJECT_DIR"
  if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "Installing npm dependencies..." >&2
    npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -5 >&2
  fi
fi

# ── 2. Source-aware context hints ──────────────────────────────────────────
case "$source" in
  compact)
    # After context compaction — restore saved state so Claude picks up where it left off.
    # Runs in ALL session types (remote + CLI): the PreCompact hook saves state regardless
    # of environment, but without restoring it here, CLI sessions lose that state entirely.
    if [ -f "$STATE_FILE" ]; then
      echo "" >&2
      echo "=== Session state restored after compaction ===" >&2
      cat "$STATE_FILE" >&2
      echo "===============================================" >&2
    fi
    ;;
  resume)
    # Resuming a paused session — quick status reminder
    branch=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
    uncommitted=$(git -C "$PROJECT_DIR" status --short 2>/dev/null | wc -l | tr -d ' ')
    echo "" >&2
    echo "=== Resumed on branch: $branch | Uncommitted files: $uncommitted ===" >&2
    ;;
  startup)
    # Fresh session — check environment health
    branch=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
    echo "" >&2
    echo "=== DMP Session Ready | Branch: $branch ===" >&2

    # Warn about missing env vars (check for template, not the actual .env)
    if [ ! -f "$PROJECT_DIR/.env" ] && [ ! -f "$PROJECT_DIR/.env.local" ]; then
      echo "  WARN: No .env or .env.local found. Copy .env.example and fill in values." >&2
    fi
    ;;
esac

# ── 3. Export useful session env vars ─────────────────────────────────────
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export DMP_PROJECT_DIR=\"$PROJECT_DIR\"" >> "$CLAUDE_ENV_FILE"
  echo "export NODE_OPTIONS=\"--max-old-space-size=2048\"" >> "$CLAUDE_ENV_FILE"
fi

exit 0
