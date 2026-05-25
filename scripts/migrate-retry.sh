#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

INTERVAL_SECONDS="${1:-600}"
LOG_FILE="logs/migrate-retry.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Retry loop iniciado (intervalo ${INTERVAL_SECONDS}s)." | tee -a "$LOG_FILE"

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tentativa de migracao..." | tee -a "$LOG_FILE"

  npm run firebase:migrate >>"$LOG_FILE" 2>&1
  status=$?

  if [ "$status" -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Migracao concluida com sucesso. Loop terminado." | tee -a "$LOG_FILE"
    exit 0
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ainda sem sucesso (status=$status). Nova tentativa em ${INTERVAL_SECONDS}s." | tee -a "$LOG_FILE"
  sleep "$INTERVAL_SECONDS"
done
