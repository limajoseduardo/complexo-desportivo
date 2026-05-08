#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs

# Start emulator in background if not already running
if ! pgrep -af "firebase emulators:start --only auth,firestore" >/dev/null; then
  nohup npm run firebase:local > logs/firebase-local.nohup.log 2>&1 < /dev/null &
  echo "Firebase Emulator arrancado em background."
  sleep 2
else
  echo "Firebase Emulator ja estava ativo."
fi

echo "Arrancar app local em foreground..."
npm run dev
