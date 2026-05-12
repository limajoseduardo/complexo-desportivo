#!/bin/bash
# Backup automático: Firebase Cloud → Local → GitHub
# Copia dados do Firebase Cloud para Emulator local e faz push para GitHub

set -e

cd "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] === Iniciando backup Firebase ==="

# Criar diretório de export se não existir
mkdir -p local-data/firebase

# 1. Iniciar emulator em background (com export-on-exit)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Iniciando Firebase Emulator..."
npm run firebase:local > /tmp/emulator.log 2>&1 &
EMULATOR_PID=$!

# Esperar para o emulator estar pronto (mais tempo para estabilizar)
sleep 15

# 2. Correr migração Cloud → Local
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Migrando dados Cloud → Local..."
npm run firebase:migrate || true

# 3. Parar emulator de forma graciosa (SIGTERM permite export-on-exit funcionar)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Parando Firebase Emulator..."
kill -TERM $EMULATOR_PID 2>/dev/null || true

# Esperar mais tempo para o export completar
sleep 5

# Verificar se exportou
EXPORT_COUNT=$(find local-data/firebase -type f 2>/dev/null | wc -l)
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Ficheiros exportados: $EXPORT_COUNT"

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
