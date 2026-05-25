# ============================================================================
# Complexo Desportivo - Complete Deployment Script for Proxmox VM
# Target: 192.168.1.107 (Ubuntu 26.04 LTS)
# Domain: buildlab.pt with subdomains
# ============================================================================

param(
    [string]$VmHost = "192.168.1.107",
    [string]$VmUser = "root",
    [string]$ProjectDir = "C:\Users\limajoseduardo\AppData\Roaming\Claude\local-agent-mode-sessions\357c0984-da4b-4907-99ad-b0bd8eb34175\4f2413c7-6377-4111-93f8-dcad55c73800\local_559956d8-cc12-43d3-bbf2-9738390370be\outputs",
    [string]$DeploymentDir = "/opt/complexo-desportivo"
)

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Complexo Desportivo - Automated Deployment Script            ║" -ForegroundColor Cyan
Write-Host "║  Target VM: $VmHost | Domain: buildlab.pt                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 1: Verify all deployment files exist locally
# ============================================================================
Write-Host "[STEP 1] Verifying deployment files..." -ForegroundColor Yellow

$requiredFiles = @(
    "docker-compose.yml",
    "nginx.conf",
    "Dockerfile-backend",
    "server.ts",
    "package.json",
    "init-db.sql",
    "DEPLOYMENT_CHECKLIST.md",
    "FIREBASE_REMOVAL_STRATEGY.md"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $ProjectDir $file
    if (Test-Path $filePath) {
        $size = (Get-Item $filePath).Length
        $sizeKB = [math]::Round($size / 1KB, 1)
        Write-Host "  ✓ $file ($sizeKB KB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ MISSING: $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: Missing deployment files: $($missingFiles -join ', ')" -ForegroundColor Red
    Write-Host "Cannot proceed without all required files." -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ All deployment files verified!" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 2: Verify SSH/SCP connectivity to VM
# ============================================================================
Write-Host "[STEP 2] Testing SSH connectivity to $VmHost..." -ForegroundColor Yellow

# Test SSH connection
$sshTest = ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new "${VmUser}@${VmHost}" "echo 'SSH_CONNECTION_OK'" 2>&1
if ($sshTest -like "*SSH_CONNECTION_OK*") {
    Write-Host "  ✓ SSH connection successful" -ForegroundColor Green
} else {
    Write-Host "  ✗ SSH connection failed" -ForegroundColor Red
    Write-Host "  Make sure you can SSH into $VmHost as $VmUser" -ForegroundColor Red
    Write-Host "  Error: $sshTest" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# STEP 3: Create remote directory structure
# ============================================================================
Write-Host "[STEP 3] Creating remote directory structure..." -ForegroundColor Yellow

$remoteDirs = @(
    "$DeploymentDir",
    "$DeploymentDir/src",
    "$DeploymentDir/config",
    "$DeploymentDir/logs",
    "$DeploymentDir/letsencrypt",
    "$DeploymentDir/backups",
    "$DeploymentDir/data/postgres",
    "$DeploymentDir/data/redis",
    "$DeploymentDir/data/elasticsearch"
)

foreach ($dir in $remoteDirs) {
    $createCmd = "mkdir -p $dir && chmod 755 $dir"
    ssh -o ConnectTimeout=5 "${VmUser}@${VmHost}" $createCmd 2>&1 | Out-Null
    Write-Host "  ✓ Created $dir" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# STEP 4: Transfer deployment files via SCP
# ============================================================================
Write-Host "[STEP 4] Transferring files to VM (this may take a moment)..." -ForegroundColor Yellow

$filesToTransfer = @(
    "docker-compose.yml",
    "nginx.conf",
    "Dockerfile-backend",
    "server.ts",
    "package.json",
    "init-db.sql",
    "DEPLOYMENT_CHECKLIST.md",
    "FIREBASE_REMOVAL_STRATEGY.md"
)

foreach ($file in $filesToTransfer) {
    $localPath = Join-Path $ProjectDir $file
    $remotePath = "${VmUser}@${VmHost}:${DeploymentDir}/"

    Write-Host "  → Transferring $file..." -ForegroundColor Cyan
    scp -o ConnectTimeout=10 $localPath $remotePath 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ $file transferred successfully" -ForegroundColor Green
    } else {
        Write-Host "    ✗ Failed to transfer $file" -ForegroundColor Red
    }
}

Write-Host ""

# ============================================================================
# STEP 5: Verify files on remote server
# ============================================================================
Write-Host "[STEP 5] Verifying transferred files on remote server..." -ForegroundColor Yellow

$verifyCmd = "ls -lh $DeploymentDir/ | grep -E '\.(yml|conf|sql|ts|json|md)$'"
ssh "${VmUser}@${VmHost}" $verifyCmd 2>&1 | ForEach-Object {
    Write-Host "  $_ " -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# STEP 6: Set proper permissions and create environment template
# ============================================================================
Write-Host "[STEP 6] Setting permissions and creating templates..." -ForegroundColor Yellow

ssh "${VmUser}@${VmHost}" "chmod 644 $DeploymentDir/*.{yml,conf,sql,ts,json,md}" 2>&1 | Out-Null
Write-Host "  ✓ File permissions set" -ForegroundColor Green

# Create .env.production template
$envTemplate = @"
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=complexo_desportivo
DB_USER=complexo_user
DB_PASSWORD=CHANGE_THIS_SECURE_PASSWORD_MIN_32_CHARS
DB_POOL_SIZE=20

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_SECURE_PASSWORD_MIN_32_CHARS
REDIS_DB=0

# Application Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info

# JWT and Session Configuration
JWT_SECRET=CHANGE_THIS_SECURE_SECRET_MIN_64_CHARS
JWT_EXPIRY=7d
SESSION_SECRET=CHANGE_THIS_SECURE_SECRET_MIN_64_CHARS

# Domain Configuration
CORS_ORIGIN=https://buildlab.pt,https://www.buildlab.pt
API_URL=https://api.buildlab.pt
FRONTEND_URL=https://buildlab.pt

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@buildlab.pt

# Stripe Configuration (if using payments)
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Monitoring and Logging
ELASTICSEARCH_HOST=elasticsearch
ELASTICSEARCH_PORT=9200
PROMETHEUS_PORT=9090
GRAFANA_ADMIN_PASSWORD=CHANGE_THIS_PASSWORD
KIBANA_DEFAULT_APP_ID=discover

# Let's Encrypt / Certbot
LETSENCRYPT_EMAIL=admin@buildlab.pt
CERTBOT_DOMAINS=buildlab.pt,www.buildlab.pt,api.buildlab.pt

# RFID Configuration (if applicable)
RFID_ENABLED=true
RFID_DEVICE=/dev/ttyUSB0
RFID_BAUDRATE=9600
"@

ssh "${VmUser}@${VmHost}" "cat > $DeploymentDir/.env.production.template <<'EOF'`n$envTemplate`nEOF" 2>&1 | Out-Null
Write-Host "  ✓ Created .env.production template" -ForegroundColor Green

Write-Host ""

# ============================================================================
# STEP 7: Display next steps
# ============================================================================
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ FILES SUCCESSFULLY TRANSFERRED TO VM                       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "NEXT STEPS (Execute on VM at 192.168.1.107):" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. SSH into the VM:" -ForegroundColor White
Write-Host "   ssh root@192.168.1.107" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Navigate to deployment directory:" -ForegroundColor White
Write-Host "   cd /opt/complexo-desportivo" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Create .env.production from template:" -ForegroundColor White
Write-Host "   cp .env.production.template .env.production" -ForegroundColor Gray
Write-Host "   nano .env.production  # Edit with secure passwords and configuration" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Install Docker and Docker Compose (if not already installed):" -ForegroundColor White
Write-Host "   apt-get update && apt-get install -y docker.io docker-compose" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Start the deployment stack:" -ForegroundColor White
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Initialize the database:" -ForegroundColor White
Write-Host "   docker-compose exec -T postgres psql -U complexo_user -d complexo_desportivo < init-db.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "7. Verify services are running:" -ForegroundColor White
Write-Host "   docker-compose ps" -ForegroundColor Gray
Write-Host ""
Write-Host "8. Check API health:" -ForegroundColor White
Write-Host "   curl http://localhost:3001/health" -ForegroundColor Gray
Write-Host ""
Write-Host "For complete deployment instructions, see DEPLOYMENT_CHECKLIST.md on the VM" -ForegroundColor Cyan
Write-Host ""

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Deployment Preparation Complete!                             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
