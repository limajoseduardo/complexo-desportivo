#!/bin/bash

# ============================================================================
# Complexo Desportivo - Server Dependencies Installation Script
# Target: Ubuntu 26.04 LTS (192.168.1.107)
# ============================================================================

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Complexo Desportivo - Installing Server Dependencies          ║"
echo "║  Target: Ubuntu 26.04 LTS                                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# STEP 1: Update system packages
# ============================================================================
echo "[STEP 1] Updating system packages..."
apt-get update
apt-get upgrade -y
echo "✓ System packages updated"
echo ""

# ============================================================================
# STEP 2: Install Node.js 20 LTS
# ============================================================================
echo "[STEP 2] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
node_version=$(node --version)
npm_version=$(npm --version)
echo "✓ Node.js $node_version installed"
echo "✓ npm $npm_version installed"
echo ""

# ============================================================================
# STEP 3: Install Docker and Docker Compose
# ============================================================================
echo "[STEP 3] Installing Docker and Docker Compose..."
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker_version=$(docker --version)
docker_compose_version=$(docker compose version)
echo "✓ $docker_version installed"
echo "✓ Docker Compose $docker_compose_version installed"
systemctl start docker
systemctl enable docker
echo "✓ Docker daemon started and enabled"
echo ""

# ============================================================================
# STEP 4: Install PostgreSQL Client
# ============================================================================
echo "[STEP 4] Installing PostgreSQL client..."
apt-get install -y postgresql-client
psql_version=$(psql --version)
echo "✓ $psql_version installed"
echo ""

# ============================================================================
# STEP 5: Install Redis CLI
# ============================================================================
echo "[STEP 5] Installing Redis CLI..."
apt-get install -y redis-tools
redis_version=$(redis-cli --version)
echo "✓ $redis_version installed"
echo ""

# ============================================================================
# STEP 6: Install Nginx
# ============================================================================
echo "[STEP 6] Installing Nginx..."
apt-get install -y nginx
nginx_version=$(nginx -v 2>&1)
echo "✓ $nginx_version installed"
systemctl start nginx
systemctl enable nginx
echo "✓ Nginx started and enabled"
echo ""

# ============================================================================
# STEP 7: Install Certbot for Let's Encrypt SSL
# ============================================================================
echo "[STEP 7] Installing Certbot (Let's Encrypt)..."
apt-get install -y certbot python3-certbot-nginx
certbot_version=$(certbot --version)
echo "✓ $certbot_version installed"
echo ""

# ============================================================================
# STEP 8: Install essential utilities
# ============================================================================
echo "[STEP 8] Installing essential utilities..."
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    nano \
    htop \
    net-tools \
    telnet \
    openssh-server \
    openssh-client \
    build-essential \
    python3 \
    python3-pip \
    sudo
echo "✓ Essential utilities installed"
echo ""

# ============================================================================
# STEP 9: Install Node.js development tools
# ============================================================================
echo "[STEP 9] Installing Node.js development tools..."
npm install -g \
    npm@latest \
    yarn \
    pm2 \
    typescript \
    @types/node
echo "✓ Global npm packages installed"
echo ""

# ============================================================================
# STEP 10: Create deployment user (optional but recommended)
# ============================================================================
echo "[STEP 10] Creating deployment user..."
if ! id -u deployer > /dev/null 2>&1; then
    useradd -m -s /bin/bash deployer
    usermod -aG docker deployer
    usermod -aG sudo deployer
    echo "✓ Deployment user 'deployer' created"
else
    echo "✓ Deployment user 'deployer' already exists"
fi
echo ""

# ============================================================================
# STEP 11: Set up deployment directory structure
# ============================================================================
echo "[STEP 11] Creating deployment directory structure..."
mkdir -p /opt/complexo-desportivo/{src,config,logs,letsencrypt,backups,data/{postgres,redis,elasticsearch}}
chown -R deployer:deployer /opt/complexo-desportivo
chmod -R 755 /opt/complexo-desportivo
echo "✓ Deployment directories created at /opt/complexo-desportivo"
echo ""

# ============================================================================
# STEP 12: Verify installations
# ============================================================================
echo "[STEP 12] Verifying all installations..."
echo ""
echo "Installed versions:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Docker: $(docker --version)"
echo "  Docker Compose: $(docker compose version 2>/dev/null || echo 'Plugin enabled')"
echo "  PostgreSQL Client: $(psql --version)"
echo "  Redis CLI: $(redis-cli --version)"
echo "  Nginx: $(nginx -v 2>&1)"
echo "  Certbot: $(certbot --version)"
echo "  Python: $(python3 --version)"
echo "  Git: $(git --version)"
echo ""

# ============================================================================
# STEP 13: Display next steps
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✓ ALL DEPENDENCIES INSTALLED SUCCESSFULLY                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Wait for deployment files to sync to /opt/complexo-desportivo/"
echo ""
echo "2. Configure environment variables:"
echo "   cp /opt/complexo-desportivo/.env.production.template /opt/complexo-desportivo/.env.production"
echo "   nano /opt/complexo-desportivo/.env.production"
echo ""
echo "3. Start Docker services:"
echo "   cd /opt/complexo-desportivo"
echo "   docker compose up -d"
echo ""
echo "4. Initialize database:"
echo "   docker compose exec -T postgres psql -U complexo_user -d complexo_desportivo < init-db.sql"
echo ""
echo "5. Configure SSL with Certbot:"
echo "   certbot certonly --standalone -d buildlab.pt -d www.buildlab.pt -d api.buildlab.pt"
echo ""
echo "6. Check service status:"
echo "   docker compose ps"
echo "   curl http://localhost:3001/health"
echo ""
echo "System is ready for deployment!"
echo ""
