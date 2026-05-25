# Complexo Desportivo de Vila de Rei
## Docker Multi-Service Sports Management Platform

### 🎯 Visão Geral

Uma plataforma completa de gerenciamento de complexo desportivo construída com **Docker**, **microserviços** e **tecnologia moderna**, projetada para ser **100% auto-suficiente** na infraestrutura local. Nenhuma dependência de serviços cloud (Google, Firebase, etc.).

**Arquitetura:**
- ✅ Completamente containerizada em Docker
- ✅ Totalmente independente de serviços externos
- ✅ Preparada para migração para servidores do Médio Tejo
- ✅ Escalável e resiliente
- ✅ Monitoramento completo integrado

---

### 📦 Serviços (11 Microserviços)

```
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                     │
│              🔒 SSL/TLS + Rate Limiting + Routing           │
└────────────────┬──────────────────────┬──────────────────────┘
                 │                      │
        ┌────────▼──────────┐  ┌───────▼───────┐
        │  Frontend (3000)  │  │  API (3001)   │
        │  React + Vite    │  │ Node + Express│
        └───────────────────┘  └───┬───────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
    ┌───▼──────┐  ┌──────▼──────┐ │ ┌────────────┐ ┌────────┴────┐
    │PostgreSQL│  │    Redis    │ │ │  RFID Srv  │ │  Reports    │
    │Database  │  │   Caching   │ │ └────────────┘ │  Service    │
    └──────────┘  └─────────────┘ │                └─────────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
              ┌───▼───┐    ┌──────▼──────┐  ┌──────▼──────┐
              │Elasticsearch│ │  Logstash   │  │  Kibana    │
              │(Logging)  │ │(Processing) │  │(Dashboard) │
              └───────────┘ └─────────────┘  └────────────┘

        ┌──────────────────────────────────────────────────┐
        │  Monitoring Stack (Prometheus + Grafana)        │
        │         📊 Métricas + 📈 Dashboards             │
        └──────────────────────────────────────────────────┘
```

#### 1. **PostgreSQL 16** (`postgres:16-alpine`)
   - Base de dados relacional principal
   - Schema: Usuários, Atividades, Classes, Inscrições, RFID
   - Backup automático: `/data/postgres`
   - Porta: `5432`

#### 2. **Redis 7** (`redis:7-alpine`)
   - Cache distribuído
   - Armazenamento de sessões JWT
   - Fila de mensagens
   - Porta: `6379`

#### 3. **Elasticsearch 8** (`elasticsearch:8.12.0`)
   - Índice centralizado de logs
   - Full-text search
   - Porta: `9200`

#### 4. **Kibana** (`kibana:8.12.0`)
   - Dashboard para visualização de logs
   - Queries e análises
   - Porta: `5601`

#### 5. **Logstash** (`logstash:8.12.0`)
   - Pipeline de processamento de logs
   - Estruturação de eventos
   - Porta: `5000` (TCP/UDP)

#### 6. **Prometheus** (`prom/prometheus`)
   - Coleta de métricas
   - Retenção de 30 dias
   - Porta: `9090`

#### 7. **Grafana** (`grafana/grafana`)
   - Dashboard de monitoramento
   - Alertas e notificações
   - Porta: `3000` (monitoramento)

#### 8. **Node.js Backend** (`backend:latest`)
   - Express.js REST API
   - JWT Authentication
   - Integração RFID
   - Processamento de dados
   - Porta: `3001`

#### 9. **React Frontend** (`frontend:latest`)
   - SPA com Vite
   - Interface responsiva
   - Real-time updates (Socket.IO)
   - Porta: `3000`

#### 10. **RFID Service** (`rfid-service:latest`)
   - Integração com hardware RFID
   - Leitura de cartões
   - Sync em tempo real
   - Acesso restrito

#### 11. **Notification Service** (`notification-service:latest`)
   - Envio de emails
   - Alertas
   - SMS (opcional)

**Serviços Complementares:**
- **Reports Service**: Geração de PDFs e relatórios
- **Nginx**: Reverse proxy, SSL/TLS, rate limiting

---

### 🏗️ Estrutura de Diretórios

```
/opt/complexo-desportivo/
├── docker-compose.yml              # Orquestração de containers
├── .env                             # Variáveis de ambiente (NÃO NO GIT)
├── .env.example                     # Template de .env
├── nginx/
│   ├── nginx.conf                  # Configuração Nginx
│   └── conf.d/
│       └── buildlab.pt.conf        # Vhosts para domínios
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts               # Entry point
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── middleware/
│       ├── models/
│       └── config/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── pages/
│       ├── components/
│       ├── store/
│       ├── services/
│       └── types/
├── config/
│   ├── prometheus.yml
│   ├── logstash.conf
│   └── grafana/
├── scripts/
│   └── migrations.sql
├── data/
│   ├── postgres/
│   ├── redis/
│   ├── elasticsearch/
│   └── logs/
│       ├── backend/
│       ├── nginx/
│       └── rfid/
└── services/
    ├── rfid-service/
    ├── notification-service/
    └── reports-service/
```

---

### 🚀 Deployment

#### Pré-requisitos
- Ubuntu 26.04 LTS (ou similar)
- Docker 24+ instalado
- Docker Compose 2.20+
- Node.js 20+ (para desenvolvimento local)
- 4GB+ RAM
- 20GB+ espaço em disco

#### Passo 1: Instalação de Dependências na VM

```bash
# Execute na VM do Proxmox
sudo bash install-dependencies.sh
```

#### Passo 2: Preparar Certificados SSL

```bash
# Gerar certificados com Let's Encrypt
sudo certbot certonly --standalone \
  -d buildlab.pt \
  -d www.buildlab.pt \
  -d api.buildlab.pt \
  -d kibana.buildlab.pt \
  -d grafana.buildlab.pt
```

#### Passo 3: Deploy Automático

```bash
# Fazer deploy de sua máquina local
chmod +x deploy.sh
./deploy.sh 192.168.1.107 deployer
```

#### Passo 4: Verificar Saúde

```bash
# SSH para VM
ssh deployer@192.168.1.107

# Verificar status
cd /opt/complexo-desportivo
docker-compose ps
docker-compose logs -f
```

---

### 🔐 Autenticação & Segurança

#### JWT (JSON Web Tokens)
```
Gerado em: /api/auth/login
Expiração: 24h (configurável)
Refresh: Redis session store
Renovação automática: Frontend
```

#### Roles/Permissões
```
- admin         → Gerenciamento total
- chefia        → Supervisão de operações
- professor     → Gerenciar classes/atividades
- staff         → Suporte administrativo
- utente        → Acesso como membro
```

#### RFID Integration
```
Leitura de cartões → RFID Service
Validação → Backend
Controle de acesso → Database
Logs auditoria → Elasticsearch
```

---

### 📊 Monitoramento & Observabilidade

#### Prometheus Métricas
```
- CPU, Memória, Disco (Host)
- Container stats (Docker)
- Database queries (PostgreSQL)
- Cache hit rates (Redis)
- API latency, requests
- Error rates
```

#### Grafana Dashboards
```
- System Overview
- API Performance
- Database Health
- User Activity
- RFID Access Logs
- Error Tracking
```

#### Logging (ELK Stack)
```
Logs → Logstash → Elasticsearch → Kibana
Formatos: JSON estruturado + full-text search
Retenção: 30 dias
```

---

### 🔄 Variáveis de Ambiente

Criar `.env` a partir de `.env.example`:

```bash
cp .env.example .env
# Editar valores
nano .env
```

**Variáveis críticas:**
```
DB_PASSWORD=...
JWT_SECRET=...
REDIS_PASSWORD=...
SMTP_HOST/USER/PASSWORD (para emails)
GRAFANA_PASSWORD=...
```

---

### 🛠️ Operações Comuns

```bash
cd /opt/complexo-desportivo

# Ver status
docker-compose ps

# Logs em tempo real
docker-compose logs -f backend    # Backend
docker-compose logs -f frontend   # Frontend
docker-compose logs -f nginx      # Nginx

# Reiniciar serviço
docker-compose restart backend

# Parar tudo
docker-compose down

# Parar com limpeza de volumes
docker-compose down -v

# Reconstruir imagem
docker-compose build --no-cache backend

# Executar comando no container
docker-compose exec backend npm run migrate

# Backup banco dados
docker-compose exec postgres pg_dump -U complexo_user complexo_desportivo > backup.sql

# Restaurar banco dados
docker-compose exec -T postgres psql -U complexo_user complexo_desportivo < backup.sql
```

---

### 🌐 Acessar Serviços

| Serviço | URL | Credenciais |
|---------|-----|-------------|
| Frontend | https://www.buildlab.pt | - |
| API | https://api.buildlab.pt | JWT Bearer |
| Kibana | https://kibana.buildlab.pt | Basic Auth |
| Grafana | https://grafana.buildlab.pt | admin/[password] |
| Prometheus | https://prometheus.buildlab.pt | Basic Auth |

---

### 🐛 Troubleshooting

#### Container não inicia
```bash
docker-compose logs <service>
docker-compose ps
```

#### Permissões negadas
```bash
sudo chown -R deployer:deployer /opt/complexo-desportivo
chmod -R 755 /opt/complexo-desportivo
```

#### Porta em uso
```bash
sudo lsof -i :3001  # Encontrar processo
sudo kill -9 <PID>  # Matar processo
```

#### Banco de dados corrompido
```bash
# Backup > Drop > Restore
docker-compose down -v
docker-compose up -d postgres
# Restaurar de backup
```

---

### 📈 Escalabilidade

**Atualmente (1 Node):**
- Max ~500 usuários simultâneos
- Max ~1000 requests/segundo

**Próximos Passos:**
- Load balancing (Nginx upstream)
- PostgreSQL replication
- Redis cluster
- Horizontal scaling de APIs

---

### 🔒 Backup & Disaster Recovery

```bash
# Backup automático (diário)
/opt/complexo-desportivo/scripts/backup.sh

# Restauração
./scripts/restore.sh <backup_file>

# Backup manual
docker-compose exec postgres pg_dump -U complexo_user complexo_desportivo | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

### 📝 API Documentation

```bash
# Acessar documentação
curl https://api.buildlab.pt/api/docs

# Estrutura de resposta
{
  "name": "Complexo Desportivo API",
  "version": "1.0.0",
  "endpoints": {
    "auth": "/api/auth",
    "users": "/api/users",
    "activities": "/api/activities",
    // ... etc
  }
}
```

---

### 🤝 Suporte e Contribuições

Para problemas ou sugestões:
1. Verificar logs: `docker-compose logs`
2. Verificar status: https://api.buildlab.pt/api/health
3. Consultar documentação: https://api.buildlab.pt/api/docs

---

### 📄 License

Propriedade de Complexo Desportivo de Vila de Rei - 2024

---

**Versão:** 1.0.0  
**Última atualização:** 2026-05-17  
**Compatibilidade:** Ubuntu 26.04 LTS, Docker 24+, Docker Compose 2.20+
