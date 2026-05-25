# Complexo Desportivo - Deployment Checklist

## Pre-Deployment: Local Preparation (Your Computer)
- [ ] Copy all deployment files from outputs folder to project directory
- [ ] Update .env with VM credentials
- [ ] Verify all YAML/configuration files are valid
- [ ] Create secure credentials file locally (not to be committed)

## Step 1: Transfer Files to VM (192.168.1.107)

### 1.1 Create project directory on VM
```bash
ssh administrator@192.168.1.107
mkdir -p /opt/complexo-desportivo
cd /opt/complexo-desportivo
```

### 1.2 Transfer deployment infrastructure files
```bash
# From your local machine:
scp -r outputs/* administrator@192.168.1.107:/opt/complexo-desportivo/

# Verify files:
ssh administrator@192.168.1.107 "ls -la /opt/complexo-desportivo/"
```

**Files to transfer**:
- [ ] docker-compose.yml
- [ ] nginx.conf
- [ ] Dockerfile-backend
- [ ] server.ts
- [ ] package.json
- [ ] init-db.sql
- [ ] .env.production (create with actual secrets)

## Step 2: Configure Environment Variables

### 2.1 Create .env.production on VM
```bash
ssh administrator@192.168.1.107

cat > /opt/complexo-desportivo/.env.production << 'EOF'
# Database Configuration
DB_USER=complexo_user
DB_PASSWORD=[STRONG_PASSWORD_HERE]
DB_HOST=postgres
DB_PORT=5432
DB_NAME=complexo_desportivo

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=[STRONG_PASSWORD_HERE]

# JWT Configuration
JWT_SECRET=[GENERATE_STRONG_SECRET]
JWT_EXPIRY=24h
SESSION_SECRET=[GENERATE_STRONG_SECRET]

# Application
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://buildlab.pt,https://www.buildlab.pt

# Base URL
VITE_BASE_URL=/
VITE_API_URL=/api

# Logging
LOG_LEVEL=info

# Email (if needed for password reset)
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_USER=noreply@buildlab.pt
SMTP_FROM=noreply@buildlab.pt
EOF

chmod 600 .env.production
```

### 2.2 Generate Secrets
```bash
# Generate strong passwords and secrets:
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # DB_PASSWORD
openssl rand -base64 32  # REDIS_PASSWORD
openssl rand -base64 32  # SESSION_SECRET
```

**⚠️ IMPORTANT**: Store these in a secure location. Use them in .env.production

## Step 3: Prepare Docker Environment

### 3.1 Install Docker & Docker Compose (if not already installed)
```bash
ssh administrator@192.168.1.107

# Check if Docker is installed
docker --version

# If not, install:
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

### 3.2 Verify Docker is running
```bash
docker ps
docker-compose --version
```

## Step 4: Deploy the Stack

### 4.1 Start all services
```bash
cd /opt/complexo-desportivo

# Pull/build images
docker-compose build

# Start services in background
docker-compose up -d

# Verify all services started
docker-compose ps
```

**Expected services**:
- [ ] postgres (port 5432)
- [ ] redis (port 6379)
- [ ] api (port 3001)
- [ ] frontend (port 80/443)
- [ ] nginx (port 80, 443, 8080)
- [ ] prometheus (port 9090)
- [ ] grafana (port 3000)
- [ ] elasticsearch (port 9200)
- [ ] kibana (port 5601)
- [ ] logstash (port 5000)

### 4.2 Check service logs
```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f api
docker-compose logs -f postgres
```

### 4.3 Wait for PostgreSQL to be ready
```bash
# Check PostgreSQL health
docker exec complexo-desportivo-postgres-1 pg_isready -U complexo_user -d complexo_desportivo

# It should return: accepting connections
```

## Step 5: Initialize Database

### 5.1 Run database initialization script
```bash
# Copy init-db.sql into the container and execute
docker exec -i complexo-desportivo-postgres-1 psql -U complexo_user -d complexo_desportivo < /opt/complexo-desportivo/init-db.sql

# Verify tables were created
docker exec complexo-desportivo-postgres-1 psql -U complexo_user -d complexo_desportivo -c "\dt"
```

**Expected tables**:
- [ ] users
- [ ] user_profiles
- [ ] facilities
- [ ] classes
- [ ] class_sessions
- [ ] class_registrations
- [ ] access_logs
- [ ] health_metrics
- [ ] meals
- [ ] training_plans
- [ ] exercises
- [ ] roles
- [ ] rfid_tags

### 5.2 Seed initial data (optional)
```bash
# Create admin user
docker exec complexo-desportivo-postgres-1 psql -U complexo_user -d complexo_desportivo << 'SQL'
INSERT INTO users (id, email, username, password_hash, first_name, last_name, role, status)
VALUES (
  gen_random_uuid(),
  'admin@buildlab.pt',
  'admin',
  '$2b$10$...',  -- bcrypt hash of password
  'Admin',
  'User',
  'admin',
  'active'
);
SQL
```

## Step 6: Configure Nginx & SSL

### 6.1 Update nginx.conf server_name
```bash
# Replace placeholder domains with actual domain
sed -i 's/buildlab.pt/buildlab.pt/g' /opt/complexo-desportivo/nginx.conf
```

### 6.2 Set up Let's Encrypt certificates
```bash
# Create certbot container
docker run --rm \
  -v /opt/complexo-desportivo/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone \
  --email admin@buildlab.pt \
  -d buildlab.pt \
  -d www.buildlab.pt \
  -d api.buildlab.pt
```

### 6.3 Update docker-compose.yml volume mounts for certificates
```yaml
# In nginx service:
volumes:
  - /opt/complexo-desportivo/letsencrypt:/etc/nginx/ssl:ro
```

### 6.4 Restart Nginx
```bash
docker-compose restart nginx
```

## Step 7: Configure DNS

### 7.1 Update DNS Records (at your domain registrar)
```
buildlab.pt         A    192.168.1.107
www.buildlab.pt     A    192.168.1.107
api.buildlab.pt     A    192.168.1.107
```

### 7.2 Verify DNS resolution
```bash
nslookup buildlab.pt
# Should resolve to 192.168.1.107
```

**Wait 15-30 minutes for DNS propagation**

## Step 8: Test Connectivity

### 8.1 Test backend API
```bash
# Health check endpoint
curl -X GET http://192.168.1.107:3001/health

# Should return:
# {"status":"ok","timestamp":"...","database":"connected","cache":"connected"}
```

### 8.2 Test user registration
```bash
curl -X POST http://192.168.1.107:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Should return:
# {"success":true,"token":"eyJ...","user":{"id":"...","email":"test@example.com",...}}
```

### 8.3 Test login
```bash
curl -X POST http://192.168.1.107:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

### 8.4 Test protected endpoint
```bash
# Replace TOKEN with the token from login response
curl -X GET http://192.168.1.107:3001/api/users/me \
  -H "Authorization: Bearer TOKEN"
```

## Step 9: Configure Monitoring

### 9.1 Access Grafana Dashboard
```
http://192.168.1.107:3000
Default credentials: admin / admin
```

- [ ] Change admin password
- [ ] Add PostgreSQL data source
- [ ] Create monitoring dashboards
- [ ] Set up alerts

### 9.2 Access Prometheus
```
http://192.168.1.107:9090
```

- [ ] Verify metrics are being collected
- [ ] Add custom dashboards
- [ ] Test alert rules

### 9.3 Access Kibana for Logging
```
http://192.168.1.107:5601
```

- [ ] Create index patterns
- [ ] Set up log analysis dashboards
- [ ] Configure alerts for errors

## Step 10: Frontend Deployment

### 10.1 Build React frontend
```bash
# On your local machine, in the project directory:
npm install
npm run build

# Output will be in dist/ folder
```

### 10.2 Deploy frontend to VM
```bash
scp -r dist/* administrator@192.168.1.107:/opt/complexo-desportivo/frontend/

# Verify
ssh administrator@192.168.1.107 "ls -la /opt/complexo-desportivo/frontend/"
```

### 10.3 Update Nginx to serve frontend
```bash
# Check nginx configuration includes frontend path
grep -A 10 "location /" /opt/complexo-desportivo/nginx.conf
```

### 10.4 Test HTTPS access
```
https://buildlab.pt
https://api.buildlab.pt
```

## Step 11: Production Verification

### 11.1 Test all critical paths
- [ ] User registration works
- [ ] Login works
- [ ] Profile page loads
- [ ] Facilities list displays
- [ ] Classes load
- [ ] Access logs recorded
- [ ] Files can be uploaded
- [ ] Health check endpoint responds

### 11.2 Verify security
- [ ] HTTPS redirect working
- [ ] Security headers present
  ```bash
  curl -I https://buildlab.pt | grep -i "strict-transport"
  ```
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] No Firebase references in frontend

### 11.3 Check database integrity
```bash
# Verify data consistency
docker exec complexo-desportivo-postgres-1 psql -U complexo_user -d complexo_desportivo << 'SQL'
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as session_count FROM user_sessions;
SELECT COUNT(*) as facility_count FROM facilities;
SQL
```

### 11.4 Monitor resource usage
```bash
# Check container resources
docker stats

# Check disk space
df -h /opt/complexo-desportivo

# Check memory
free -h
```

## Step 12: Backup Configuration

### 12.1 Set up PostgreSQL backups
```bash
# Create backup directory
mkdir -p /opt/complexo-desportivo/backups

# Create backup script
cat > /opt/complexo-desportivo/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/complexo-desportivo/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec complexo-desportivo-postgres-1 pg_dump -U complexo_user -d complexo_desportivo > $BACKUP_DIR/backup_$TIMESTAMP.sql
# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
EOF

chmod +x /opt/complexo-desportivo/backup-db.sh
```

### 12.2 Schedule daily backups
```bash
# Add to crontab
crontab -e

# Add line:
0 2 * * * /opt/complexo-desportivo/backup-db.sh
```

## Step 13: Ongoing Maintenance

### 13.1 Regular checks
```bash
# Check disk space
df -h

# Check log sizes
du -sh /opt/complexo-desportivo/logs

# Check database size
docker exec complexo-desportivo-postgres-1 psql -U complexo_user -d complexo_desportivo -c "SELECT pg_size_pretty(pg_database_size('complexo_desportivo'));"
```

### 13.2 Update SSL certificates (automated via Certbot)
```bash
# Renewal should be automatic, but test:
docker run --rm \
  -v /opt/complexo-desportivo/letsencrypt:/etc/letsencrypt \
  certbot/certbot renew --dry-run
```

### 13.3 Monitor logs for errors
```bash
# Check API logs
docker-compose logs api | grep -i error

# Check Nginx logs
docker-compose logs nginx | grep -i error

# Check PostgreSQL logs
docker-compose logs postgres | grep -i error
```

## Troubleshooting

### Services not starting
```bash
# Check individual service logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs api

# Restart single service
docker-compose restart api
```

### Database connection issues
```bash
# Test connection
docker exec complexo-desportivo-postgres-1 psql -U complexo_user -d complexo_desportivo -c "SELECT 1"

# Check password in .env
grep DB_PASSWORD /opt/complexo-desportivo/.env.production
```

### SSL certificate issues
```bash
# Check certificate validity
openssl x509 -in /opt/complexo-desportivo/letsencrypt/live/buildlab.pt/fullchain.pem -text -noout

# Test HTTPS
curl -v https://buildlab.pt
```

### API not responding
```bash
# Check if port 3001 is open
netstat -tlnp | grep 3001

# Check API logs
docker-compose logs api -f

# Restart API
docker-compose restart api
```

## Success Checklist ✅

- [ ] All Docker services running
- [ ] PostgreSQL database initialized with all tables
- [ ] API responding on port 3001
- [ ] Frontend deployed and accessible via HTTPS
- [ ] Domain buildlab.pt resolving to VM
- [ ] SSL certificates valid and active
- [ ] User registration and login working
- [ ] Database backups scheduled
- [ ] Monitoring dashboards accessible
- [ ] Zero Firebase references in code
- [ ] All data stored locally (PostgreSQL, Redis)
- [ ] No external API dependencies
- [ ] Production environment configured

---

**Notes for Médio Tejo Deployment**:
- Update CORS_ORIGIN for their domain
- Configure their SMTP server for email notifications
- Set appropriate database backup retention
- Monitor resource usage after peak hours
- Plan for database replication for high availability
- Consider load balancing if scaling multiple servers

