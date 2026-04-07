#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install npm dependencies (uses lockfile, idempotent)
cd "$CLAUDE_PROJECT_DIR"
npm install

# Fix playwright.config.js chromium path if it still points to the old location
CONFIG="$CLAUDE_PROJECT_DIR/playwright.config.js"
if grep -q '/root/.cache/ms-playwright' "$CONFIG" 2>/dev/null; then
  sed -i 's|/root/.cache/ms-playwright|/opt/pw-browsers|g' "$CONFIG"
fi

# Start the Vite test server on port 5174 if not already running
if ! curl -s --max-time 2 http://localhost:5174 > /dev/null 2>&1; then
  nohup npx vite --config "$CLAUDE_PROJECT_DIR/vite.config.test.js" --port 5174 \
    > /tmp/vite-test.log 2>&1 &
  # Wait up to 15s for the server to be ready
  for i in $(seq 1 15); do
    if curl -s --max-time 1 http://localhost:5174 > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi
