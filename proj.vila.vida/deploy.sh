#!/bin/bash
# Deployment script for Complexo Desportivo Docker Stack
# This script deploys the entire application to the VM

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VM_IP="${1:-192.168.1.107}"
VM_USER="${2:-deployer}"
DEPLOYMENT_PATH="/opt/complexo-desportivo"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Complexo Desportivo - Docker Stack Deployment           ║${NC}"
echo -e "${BLUE}║                  Vila de Rei 2024                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${YELLOW}📋 Configuração de Deployment:${NC}"
echo -e "   VM IP: ${GREEN}${VM_IP}${NC}"
echo -e "   VM User: ${GREEN}${VM_USER}${NC}"
echo -e "   Deployment Path: ${GREEN}${DEPLOYMENT_PATH}${NC}"
echo -e "   Project Dir: ${GREEN}${PROJECT_DIR}${NC}"

# Function to run command on VM
run_on_vm() {
    local cmd="$1"
    echo -e "\n${YELLOW}▶ Executando: ${cmd}${NC}"
    ssh "${VM_USER}@${VM_IP}" "cd ${DEPLOYMENT_PATH} && ${cmd}"
}

# Function to copy files to VM
copy_to_vm() {
    local source="$1"
    local dest="$2"
    echo -e "${YELLOW}▶ Copiando: ${source} → ${dest}${NC}"
    scp -r "${source}" "${VM_USER}@${VM_IP}:${dest}"
}

# Check prerequisites
echo -e "\n${YELLOW}🔍 Verificando pré-requisitos...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker não está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker instalado${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose não está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose instalado${NC}"

if ! command -v ssh &> /dev/null; then
    echo -e "${RED}✗ SSH não está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SSH instalado${NC}"

# Test SSH connection
echo -e "\n${YELLOW}🔐 Testando conexão SSH...${NC}"
if ssh -o ConnectTimeout=5 "${VM_USER}@${VM_IP}" "echo 'Connected'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH conectado${NC}"
else
    echo -e "${RED}✗ Não foi possível conectar ao VM via SSH${NC}"
    exit 1
fi

# Copy project files to VM
echo -e "\n${YELLOW}📦 Copiando arquivos do projeto...${NC}"

# Create deployment directory structure
run_on_vm "sudo mkdir -p ${DEPLOYMENT_PATH}/{backend/src,frontend/src,nginx/conf.d,config,scripts,data/{postgres,redis,elasticsearch,logs/{backend,nginx,rfid,notifications,reports}}}"
run_on_vm "sudo chown -R ${VM_USER}:${VM_USER} ${DEPLOYMENT_PATH}"
run_on_vm "chmod -R 755 ${DEPLOYMENT_PATH}"

# Copy Docker Compose
copy_to_vm "${PROJECT_DIR}/docker-compose.yml" "${DEPLOYMENT_PATH}/"
echo -e "${GREEN}✓ docker-compose.yml copiado${NC}"

# Copy environment file
copy_to_vm "${PROJECT_DIR}/.env.example" "${DEPLOYMENT_PATH}/.env"
echo -e "${GREEN}✓ .env copiado${NC}"

# Copy backend files
copy_to_vm "${PROJECT_DIR}/backend/package.json" "${DEPLOYMENT_PATH}/backend/"
copy_to_vm "${PROJECT_DIR}/backend/package-lock.json" "${DEPLOYMENT_PATH}/backend/" 2>/dev/null || true
copy_to_vm "${PROJECT_DIR}/backend/tsconfig.json" "${DEPLOYMENT_PATH}/backend/"
copy_to_vm "${PROJECT_DIR}/backend/Dockerfile" "${DEPLOYMENT_PATH}/backend/"
copy_to_vm "${PROJECT_DIR}/backend/src" "${DEPLOYMENT_PATH}/backend/"
echo -e "${GREEN}✓ Backend files copiados${NC}"

# Copy frontend files
copy_to_vm "${PROJECT_DIR}/frontend/package.json" "${DEPLOYMENT_PATH}/frontend/"
copy_to_vm "${PROJECT_DIR}/frontend/package-lock.json" "${DEPLOYMENT_PATH}/frontend/" 2>/dev/null || true
copy_to_vm "${PROJECT_DIR}/frontend/vite.config.ts" "${DEPLOYMENT_PATH}/frontend/"
copy_to_vm "${PROJECT_DIR}/frontend/Dockerfile" "${DEPLOYMENT_PATH}/frontend/"
copy_to_vm "${PROJECT_DIR}/frontend/src" "${DEPLOYMENT_PATH}/frontend/" 2>/dev/null || true
copy_to_vm "${PROJECT_DIR}/frontend/public" "${DEPLOYMENT_PATH}/frontend/" 2>/dev/null || true
copy_to_vm "${PROJECT_DIR}/frontend/index.html" "${DEPLOYMENT_PATH}/frontend/" 2>/dev/null || true
echo -e "${GREEN}✓ Frontend files copiados${NC}"

# Copy Nginx configuration
copy_to_vm "${PROJECT_DIR}/nginx/nginx.conf" "${DEPLOYMENT_PATH}/nginx/"
copy_to_vm "${PROJECT_DIR}/nginx/conf.d" "${DEPLOYMENT_PATH}/nginx/"
echo -e "${GREEN}✓ Nginx configuration copiado${NC}"

# Copy configuration files
copy_to_vm "${PROJECT_DIR}/config/" "${DEPLOYMENT_PATH}/"
echo -e "${GREEN}✓ Configuration files copiados${NC}"

# Build and start services
echo -e "\n${YELLOW}🚀 Construindo e iniciando serviços...${NC}"

# Pull base images
echo -e "${YELLOW}▶ Puxando imagens base...${NC}"
run_on_vm "docker-compose pull"
echo -e "${GREEN}✓ Imagens puxadas${NC}"

# Build custom images
echo -e "${YELLOW}▶ Construindo imagens customizadas...${NC}"
run_on_vm "docker-compose build --no-cache"
echo -e "${GREEN}✓ Imagens construídas${NC}"

# Start services
echo -e "${YELLOW}▶ Iniciando serviços Docker...${NC}"
run_on_vm "docker-compose up -d"
echo -e "${GREEN}✓ Serviços iniciados${NC}"

# Wait for services to be ready
echo -e "\n${YELLOW}⏳ Aguardando serviços ficarem prontos...${NC}"
sleep 15

# Check service health
echo -e "${YELLOW}🏥 Verificando saúde dos serviços...${NC}"
run_on_vm "docker-compose ps"

# Check logs
echo -e "\n${YELLOW}📋 Últimos logs dos serviços:${NC}"
run_on_vm "docker-compose logs --tail=20"

# Run database migrations
echo -e "\n${YELLOW}🗄️  Executando migrações de banco de dados...${NC}"
run_on_vm "docker-compose exec -T backend npm run migrate" || echo -e "${YELLOW}⚠️  Migrações podem já estar executadas${NC}"

# Seed database (optional)
echo -e "\n${YELLOW}🌱 Seeding banco de dados...${NC}"
run_on_vm "docker-compose exec -T backend npm run seed" || echo -e "${YELLOW}⚠️  Seed pode já estar executado${NC}"

# Summary
echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✓ Deployment Completado com Sucesso!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${BLUE}📍 Acessar a aplicação:${NC}"
echo -e "   ${GREEN}Frontend: https://www.buildlab.pt${NC}"
echo -e "   ${GREEN}API: https://api.buildlab.pt${NC}"
echo -e "   ${GREEN}Kibana: https://kibana.buildlab.pt${NC}"
echo -e "   ${GREEN}Grafana: https://grafana.buildlab.pt${NC}"

echo -e "\n${BLUE}🔧 Comandos úteis:${NC}"
echo -e "   ${YELLOW}Ver logs: ssh ${VM_USER}@${VM_IP} 'cd ${DEPLOYMENT_PATH} && docker-compose logs -f'${NC}"
echo -e "   ${YELLOW}Parar serviços: ssh ${VM_USER}@${VM_IP} 'cd ${DEPLOYMENT_PATH} && docker-compose down'${NC}"
echo -e "   ${YELLOW}Reiniciar: ssh ${VM_USER}@${VM_IP} 'cd ${DEPLOYMENT_PATH} && docker-compose restart'${NC}"
echo -e "   ${YELLOW}Status: ssh ${VM_USER}@${VM_IP} 'cd ${DEPLOYMENT_PATH} && docker-compose ps'${NC}"

echo -e "\n${BLUE}🔐 Configuração de SSL:${NC}"
echo -e "   ${YELLOW}Execute Certbot para gerar certificados:${NC}"
echo -e "   ${YELLOW}ssh ${VM_USER}@${VM_IP} 'sudo certbot certonly --standalone -d buildlab.pt -d www.buildlab.pt -d api.buildlab.pt'${NC}"

echo -e "\n${BLUE}📚 Documentação:${NC}"
echo -e "   ${YELLOW}API Docs: https://api.buildlab.pt/api/docs${NC}"

exit 0
