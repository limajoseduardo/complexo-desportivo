#!/bin/bash
# Backup automático: Firebase Cloud → Local → GitHub
# Copia dados do Firebase Cloud para Emulator local e faz push para GitHub

set -e

cd "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] === Iniciando backup Firebase ==="

# 1. Iniciar emulator em background (com export-on-exit)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Iniciando Firebase Emulator..."
npm run firebase:local &
EMULATOR_PID=$!

# Esperar para o emulator estar pronto
sleep 10

# 2. Correr migração Cloud → Local
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Migrando dados Cloud → Local..."
npm run firebase:migrate || true

# 3. Parar emulator (isso vai fazer export automático para local-data/)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Parando Firebase Emulator..."
kill $EMULATOR_PID 2>/dev/null || true
sleep 3

# 4. Git: commit e push
if [ -d "local-data" ]; then
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Fazendo backup para GitHub..."
  git add local-data/ || true

  if git diff --cached --quiet; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Sem mudanças. Nada para fazer."
  else
    TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')
    git commit -m "backup: $TIMESTAMP" || true
    git push origin main || echo "[$(date +'%Y-%m-%d %H:%M:%S')] Aviso: push falhou"
  fi
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] === Backup completo ==="
