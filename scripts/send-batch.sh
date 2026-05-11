#!/usr/bin/env bash
# Cron-safe wrapper for `npm run send`.
#
# Designed for: Linux + nvm + cron.
# Resolves: nvm PATH (cron has minimal env), skips weekends, logs to ./logs/cron-YYYY-MM-DD.log.
#
# Usage (manual):
#   bash scripts/send-batch.sh --live --cap 10 --daily-cap 30 --template T1_NAMED_PERSON
#
# Usage (cron — see crontab.example):
#   30 9 * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 30

set -euo pipefail

# --- Configurable paths ---
PROJECT_DIR="/home/primathon/Documents/p_projet/ColdOutrichAutoEmail"
NVM_NODE_DIR="/home/primathon/.nvm/versions/node/v24.14.0/bin"
LOG_DIR="$PROJECT_DIR/logs"

# --- Setup ---
mkdir -p "$LOG_DIR"
DATESTAMP="$(date +%Y-%m-%d)"
LOG_FILE="$LOG_DIR/cron-$DATESTAMP.log"
TS() { date -Is; }

# Skip weekends (1=Mon..7=Sun). Comment out if you want weekend sends.
DOW="$(date +%u)"
if [ "$DOW" -ge 6 ]; then
  echo "[$(TS)] SKIP weekend (DOW=$DOW). Args: $*" >> "$LOG_FILE"
  exit 0
fi

# Put nvm node first on PATH so `npm run send` finds the right node binary.
export PATH="$NVM_NODE_DIR:$PATH"

# Move into project dir so relative paths (./email_outreach_list.xlsx, ./sent.log) resolve correctly.
cd "$PROJECT_DIR"

# Header — makes the log readable when you tail it.
{
  echo ""
  echo "================================================================"
  echo "[$(TS)] START batch run"
  echo "  args:      $*"
  echo "  node:      $(node --version)"
  echo "  cwd:       $(pwd)"
  echo "================================================================"
} >> "$LOG_FILE"

# Run the send. Pass --live + --cap + --daily-cap + (optional --template) via cron.
# Exit code propagates so cron can email you on failure if you have MAILTO configured.
EXIT_CODE=0
"$NVM_NODE_DIR/npm" run send -- "$@" >> "$LOG_FILE" 2>&1 || EXIT_CODE=$?

echo "[$(TS)] END batch run — exit=$EXIT_CODE" >> "$LOG_FILE"
exit "$EXIT_CODE"
