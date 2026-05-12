#!/bin/bash
# Setup automático de backup Firebase → GitHub
# Execute na VM: bash scripts/setup-backup.sh

set -e

echo "================================"
echo "Setup Backup Automático"
echo "================================"

# 1. Instalar Java
echo "[1/5] Instalando Java..."
sudo apt-get update > /dev/null
sudo apt-get install -y default-jre-headless > /dev/null
echo "✅ Java instalado"

# 2. Instalar dependências npm
echo "[2/5] Instalando dependências npm..."
npm install > /dev/null 2>&1
echo "✅ npm install completo"

# 3. Gerar SSH key para backup
echo "[3/5] Configurando Git SSH..."
if [ ! -f ~/.ssh/id_ed25519 ]; then
  ssh-keygen -t ed25519 -C "backup-vm" -N "" -f ~/.ssh/id_ed25519 > /dev/null
  echo "✅ SSH key gerada"
else
  echo "✅ SSH key já existe"
fi

# Mostrar chave pública para adicionar no GitHub
echo ""
echo "⚠️  PRÓXIMO PASSO MANUAL:"
echo "Copie a chave abaixo e adicione em GitHub > Settings > SSH Keys > New SSH key"
echo "---"
cat ~/.ssh/id_ed25519.pub
echo "---"
read -p "Pressione ENTER após adicionar a chave no GitHub..."

# 4. Configurar remote git para SSH
echo "[4/5] Configurando git remote..."
git remote set-url origin git@github.com:limajoseduardo/complexo-desportivo.git
echo "✅ Git configurado para SSH"

# 5. Configurar cron job
echo "[5/5] Configurando cron job..."
CRON_CMD="0 3 * * * cd ~/complexo-desportivo && bash scripts/backup-to-github.sh >> /var/log/firebase-backup.log 2>&1"

if crontab -l 2>/dev/null | grep -q "backup-to-github.sh"; then
  echo "✅ Cron job já existe"
else
  (crontab -l 2>/dev/null || echo "") | { cat; echo "$CRON_CMD"; } | crontab -
  echo "✅ Cron job configurado (diariamente às 3:00 AM)"
fi

# Teste manual do backup
echo ""
echo "================================"
echo "Testando backup (primeira vez)..."
echo "================================"
bash scripts/backup-to-github.sh

echo ""
echo "================================"
echo "✅ SETUP COMPLETO!"
echo "================================"
echo ""
echo "Backup automático configurado para:"
echo "  • Executar todos os dias às 3:00 AM"
echo "  • Exportar dados Firebase Cloud → JSON"
echo "  • Commit + push para GitHub automaticamente"
echo ""
echo "Logs dos backups: /var/log/firebase-backup.log"
echo "Próximo backup: amanhã às 3:00 AM"
