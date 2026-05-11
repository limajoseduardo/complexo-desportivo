#!/bin/bash
# Deploy no Ubuntu Server (Proxmox VM)
# Executar como root ou com sudo

set -e

echo "=== Complexo Desportivo - Deploy Ubuntu Server ==="

# 1. Instalar Docker se não existir
if ! command -v docker &> /dev/null; then
  echo "[+] A instalar Docker..."
  apt-get update -qq
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y docker-ce docker-ce-cli docker-compose-plugin
  systemctl enable docker
  echo "[+] Docker instalado."
fi

# 2. Verificar .env
if [ ! -f .env ]; then
  echo "[!] Cria o ficheiro .env primeiro:"
  echo "    cp .env.example .env && nano .env"
  exit 1
fi

# 3. Build e arrancar
echo "[+] A fazer build e arrancar..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

echo ""
echo "[OK] App disponível em http://$(hostname -I | awk '{print $1}')"
echo "     Para ver logs: docker compose logs -f"
