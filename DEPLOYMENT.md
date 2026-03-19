# Deployment Guide — AI GitHub Debugging Assistant

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [GitHub OAuth Setup](#github-oauth-setup)
3. [Local Development](#local-development)
4. [Environment Variables](#environment-variables)
5. [Production Deployment](#production-deployment)
6. [Deploying to Cloud Platforms](#deploying-to-cloud-platforms)
7. [Database Management](#database-management)
8. [Monitoring & Logging](#monitoring--logging)
9. [Security Hardening](#security-hardening)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Minimum Version | Purpose |
|---|---|---|
| Docker | 24.x | Container runtime |
| Docker Compose | v2.x | Multi-service orchestration |
| Git | 2.x | Cloning repos for indexing |
| Node.js | 20.x | Frontend/backend (local dev) |
| Python | 3.11+ | AI engine (local dev) |

---

## GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps**
2. Click **New OAuth App**
3. Fill in:

```
Application name:  AI GitHub Debugger
Homepage URL:      https://your-domain.com      (or http://localhost:3000 for dev)
Callback URL:      https://your-domain.com/api/auth/callback/github
                   (or http://localhost:3000/api/auth/callback/github for dev)
```

4. Click **Register application**
5. Copy **Client ID** and generate a **Client Secret**

### Step 2: Set Required OAuth Scopes

The app requests these scopes automatically:
- `read:user` — read GitHub username and avatar
- `user:email` — read email address
- `repo` — read/write repositories (needed to create branches and PRs)

---

## Local Development

### Quick Start

```bash
# 1. Clone
git clone https://github.com/yourname/ai-github-debugger.git
cd ai-github-debugger

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# 3. Start all services
./deploy.sh dev
# OR
docker compose up --build

# 4. Open browser
open http://localhost:3000
```

### Service URLs (Development)

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:3000 | Next.js dev server |
| Backend API | http://localhost:4000 | Express with hot reload |
| AI Engine | http://localhost:8000 | FastAPI |
| AI Engine Docs | http://localhost:8000/docs | Swagger UI |
| ChromaDB | http://localhost:8001 | Vector database |
| MongoDB | mongodb://localhost:27017 | Use MongoDB Compass to inspect |

### Running Services Individually (without Docker)

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**AI Engine:**
```bash
cd ai-engine
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # fill in credentials
uvicorn main:app --reload --port 8000
```

**ChromaDB (Docker only):**
```bash
docker run -p 8001:8000 -v chroma-data:/chroma/chroma chromadb/chroma:latest
```

**MongoDB (Docker only):**
```bash
docker run -p 27017:27017 -v mongo-data:/data/db mongo:7.0
```

---

## Environment Variables

### Root `.env` file

```bash
# ── GitHub OAuth ─────────────────────────────────────────────
# From: https://github.com/settings/developers
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── NextAuth ─────────────────────────────────────────────────
# Generate: openssl rand -base64 32
NEXTAUTH_SECRET=your-32-char-secret-here
NEXTAUTH_URL=http://localhost:3000

# ── Backend Security ──────────────────────────────────────────
# Generate: openssl rand -base64 32
JWT_SECRET=your-jwt-secret-here
# Generate: openssl rand -hex 16  (must be 32 hex chars)
ENCRYPTION_KEY=your-32-hex-char-key-here

# ── AI Models ────────────────────────────────────────────────
# OpenAI: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# DeepSeek (optional fallback): https://platform.deepseek.com
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── MongoDB (production only) ─────────────────────────────────
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=change-this-strong-password

# ── Frontend ──────────────────────────────────────────────────
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### Generating Secrets

```bash
# NEXTAUTH_SECRET and JWT_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY (must be 32 hex characters = 256 bits)
openssl rand -hex 16
```

---

## Production Deployment

### Option A: Single Server (Docker Compose)

Suitable for: small teams, personal use, low traffic (<1000 req/day)

```bash
# 1. SSH into your server
ssh user@your-server.com

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Clone the project
git clone https://github.com/yourname/ai-github-debugger.git /opt/ai-debugger
cd /opt/ai-debugger

# 4. Configure environment
cp .env.example .env
nano .env  # Fill in all production values

# 5. Generate SSL certificate (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/ssl/key.pem

# 6. Update nginx.conf with your domain
sed -i 's/your-domain.com/actual-domain.com/g' docker/nginx.conf

# 7. Start production stack
./deploy.sh prod

# 8. Verify
curl https://your-domain.com/health
```

### Option B: Separate Services (Recommended for scale)

Deploy each service independently:

```
Frontend  → Vercel / Netlify / Cloudflare Pages
Backend   → Railway / Render / Fly.io / EC2
AI Engine → Modal.com / Replicate / EC2 with GPU
ChromaDB  → Chroma Cloud / self-hosted
MongoDB   → MongoDB Atlas (free tier available)
```

---

## Deploying to Cloud Platforms

### Vercel (Frontend)

```bash
cd frontend
npx vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_BACKEND_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
# GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
```

### Railway (Backend + AI Engine)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy backend
cd backend
railway init
railway up

# Deploy AI engine
cd ai-engine
railway init
railway up

# Set env vars
railway variables set OPENAI_API_KEY=sk-...
railway variables set MONGODB_URI=...
```

### MongoDB Atlas (Database)

1. Create free account at https://cloud.mongodb.com
2. Create a cluster (M0 free tier)
3. Add IP allowlist: `0.0.0.0/0` (or restrict to your server IP)
4. Create database user
5. Copy connection string to `MONGODB_URI`

```
mongodb+srv://username:password@cluster.mongodb.net/ai-debugger?retryWrites=true&w=majority
```

### Fly.io (Backend)

```bash
cd backend
fly launch
fly secrets set MONGODB_URI="..." OPENAI_API_KEY="..."
fly deploy
```

---

## Database Management

### MongoDB Indexes

Indexes are created automatically by the Mongoose schemas, but you can also run:

```bash
docker exec -it ai-debugger-mongo-1 mongosh ai-debugger
```

```javascript
// Verify indexes exist
db.users.getIndexes()
db.repositories.getIndexes()
db.analyses.getIndexes()
db.pullrequests.getIndexes()
```

### Backup

```bash
# Create backup
docker exec ai-debugger-mongo-1 mongodump \
  --db ai-debugger \
  --out /data/backup-$(date +%Y%m%d)

# Copy backup from container
docker cp ai-debugger-mongo-1:/data/backup-20240101 ./backups/

# Restore
docker exec ai-debugger-mongo-1 mongorestore \
  --db ai-debugger \
  /data/backup-20240101/ai-debugger
```

### ChromaDB Data

ChromaDB stores vectors in the Docker volume `chroma-data`. To backup:

```bash
docker run --rm \
  -v ai-debugger_chroma-data:/source:ro \
  -v $(pwd)/chroma-backup:/backup \
  alpine tar czf /backup/chroma-$(date +%Y%m%d).tar.gz -C /source .
```

---

## Monitoring & Logging

### View Logs

```bash
# All services
./deploy.sh logs

# Specific service
docker compose logs -f backend
docker compose logs -f ai-engine
docker compose logs -f frontend
```

### Log Files (Backend)

The backend writes structured logs to:
- `backend/logs/combined.log` — all log levels
- `backend/logs/error.log` — errors only

### Health Endpoints

```bash
# Backend health
curl http://localhost:4000/health

# AI Engine health
curl http://localhost:8000/health

# ChromaDB health
curl http://localhost:8001/api/v1/heartbeat
```

### Recommended Monitoring Stack

For production, add these to `docker-compose.prod.yml`:

```yaml
  # Prometheus metrics collection
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./docker/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  # Grafana dashboards
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=your-grafana-password
```

---

## Security Hardening

### Firewall Rules

```bash
# Allow only necessary ports in production
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirects to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw deny 27017      # Block MongoDB from outside
ufw deny 8000       # Block AI engine from outside
ufw deny 8001       # Block ChromaDB from outside
ufw deny 4000       # Block backend from outside (nginx handles it)
ufw enable
```

### Secrets Rotation

Rotate these secrets every 90 days:
1. `ENCRYPTION_KEY` — requires re-encrypting all stored tokens
2. `JWT_SECRET` — invalidates all active sessions (users re-login)
3. `NEXTAUTH_SECRET` — invalidates NextAuth sessions
4. GitHub OAuth Secret — update in GitHub Developer Settings

### Token Re-encryption Script

If you rotate `ENCRYPTION_KEY`:

```typescript
// scripts/rotate-encryption-key.ts
import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';

const OLD_KEY = process.env.OLD_ENCRYPTION_KEY!;
const NEW_KEY = process.env.NEW_ENCRYPTION_KEY!;

async function rotateKeys() {
  const users = await mongoose.model('User').find({}).select('+_encryptedToken');
  for (const user of users) {
    const decrypted = CryptoJS.AES.decrypt(user._encryptedToken, OLD_KEY).toString(CryptoJS.enc.Utf8);
    user._encryptedToken = CryptoJS.AES.encrypt(decrypted, NEW_KEY).toString();
    await user.save();
    console.log(`Rotated token for ${user.login}`);
  }
}
```

### Content Security Policy

The nginx config includes CSP headers. For production, audit and tighten:

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.github.com https://avatars.githubusercontent.com;
  img-src 'self' data: https://avatars.githubusercontent.com;
  font-src 'self' https://fonts.gstatic.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
";
```

---

## Troubleshooting

### Common Issues

**`Cannot connect to MongoDB`**
```bash
# Check MongoDB is running
docker compose ps mongo
docker compose logs mongo

# Verify connection string
docker exec -it ai-debugger-backend-1 node -e \
  "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK'))"
```

**`ChromaDB collection not found`**
- The repository needs to be indexed first
- Check AI engine logs: `docker compose logs ai-engine`
- Verify ChromaDB is running: `curl http://localhost:8001/api/v1/heartbeat`

**`GitHub OAuth callback error`**
- Ensure `NEXTAUTH_URL` matches exactly with the GitHub OAuth app callback URL
- For production: must be HTTPS
- Check callback URL in GitHub Developer Settings

**`AI analysis times out`**
- Default timeout is 3 minutes for analysis, 10 minutes for indexing
- Large repositories (>10,000 files) may need longer timeouts
- Check `OPENAI_API_KEY` is valid and has quota

**`Rate limit hit on AI endpoints`**
- Default: 10 AI requests per minute per IP
- Adjust in `backend/src/index.ts`:
  ```typescript
  const aiLimiter = rateLimit({ windowMs: 60000, max: 20 }); // increase max
  ```

**`Patch application fails in PR creation`**
- Verify the GitHub token has `repo` scope
- Check the file paths in the patch match actual repo file structure
- Look for merge conflicts if file was recently modified

### Reset Everything

```bash
# ⚠️  Deletes all data
./deploy.sh reset

# Restart fresh
./deploy.sh dev
```

### Debug Mode

```bash
# Run backend with verbose logging
LOG_LEVEL=debug docker compose up backend

# Run AI engine with debug mode
ENV=development docker compose up ai-engine
```
