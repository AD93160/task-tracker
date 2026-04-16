#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install npm dependencies
npm install

# Install Playwright browsers if the expected Chromium binary is missing
CHROMIUM_BIN="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
if [ ! -f "$CHROMIUM_BIN" ]; then
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium
fi

# Start the Vite test server (mocked Firebase) on port 5174 if not already running
if ! curl -s --max-time 2 http://localhost:5174 > /dev/null 2>&1; then
  nohup npx vite --config "$CLAUDE_PROJECT_DIR/vite.config.test.js" --port 5174 \
    > /tmp/vite-test.log 2>&1 &
  # Wait up to 20s for the server to be ready
  for i in $(seq 1 20); do
    if curl -s --max-time 1 http://localhost:5174 > /dev/null 2>&1; then
      echo "Vite test server ready on port 5174"
      break
    fi
    sleep 1
  done
fi
