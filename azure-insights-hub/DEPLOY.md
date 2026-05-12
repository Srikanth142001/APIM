# Azure Insights Hub — Real World Deployment Guide

## Option 1: Single Container (simplest) ⭐

Everything in one container — one `docker run`, one port.

```
Browser → port 80 → nginx → /api/* → Node.js backend (internal)
                          → /*     → React frontend (static files)
```

### Build

```bash
cd azure-insights-hub
docker build -f Dockerfile.combined -t azure-insights-hub .
```

### Run

```bash
docker run -d \
  --name azure-insights-hub \
  -p 3001:80 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="YourSecurePassword" \
  -e DEFAULT_ENV_NAME="Production" \
  -e DEFAULT_APP_INSIGHTS_APP_ID="your-app-insights-app-id" \
  -e DEFAULT_APP_INSIGHTS_API_KEY="your-app-insights-api-key" \
  -e DEFAULT_SUBSCRIPTION_ID="your-azure-subscription-id" \
  -e DEFAULT_RESOURCE_GROUP="your-resource-group" \
  -v aih-data:/app/data \
  --restart unless-stopped \
  azure-insights-hub
```

Open: `http://YOUR_SERVER_IP:3001`

**Change the port** — just change `-p 8080:80` to run on port 8080 instead.

No need to configure backend IP/hostname — nginx proxies `/api` to the backend internally.

---

## Option 2: Two Containers (more flexible)

```
Browser → Frontend Container (nginx, any port)
              ↓ reads config.js (written at startup from env vars)
              ↓ API calls to backend
          Backend Container (Node.js, any port)
              ↓ queries Azure App Insights API
              ↓ stores environments in SQLite (persisted via volume)
```

## Step 1 — Build and push images to Docker Hub

```bash
# Build both images
docker build -t YOUR_DOCKERHUB/aih-backend:latest ./azure-insights-hub/backend
docker build -t YOUR_DOCKERHUB/aih-frontend:latest ./azure-insights-hub/frontend

# Push to Docker Hub
docker push YOUR_DOCKERHUB/aih-backend:latest
docker push YOUR_DOCKERHUB/aih-frontend:latest
```

---

## Step 2 — Run on any server

### Option A: docker-compose (recommended)

Create a `.env` file on the server:

```env
# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=your-strong-random-secret-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# ── Ports ─────────────────────────────────────────────────────────────────────
FRONTEND_PORT=3001          # Port users open in browser
BACKEND_PORT=5001           # Port backend listens on

# ── Frontend → Backend connection ─────────────────────────────────────────────
# This is the IP/hostname the BROWSER uses to reach the backend
# If both containers are on same server: use the server's IP or hostname
# If backend is on a different server: use that server's IP
API_HOSTNAME=192.168.1.100  # ← change to your server IP
API_PORT=5001               # ← same as BACKEND_PORT above
API_PROTOCOL=http           # http or https

# ── Optional: Pre-seed a default Azure environment ────────────────────────────
# If set, this environment is auto-created in the DB on first startup
# Users can also add environments via the UI after login
DEFAULT_ENV_NAME=My Production
DEFAULT_APP_INSIGHTS_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DEFAULT_APP_INSIGHTS_API_KEY=your-app-insights-api-key
DEFAULT_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DEFAULT_RESOURCE_GROUP=my-resource-group
```

Then run:

```bash
docker-compose up -d
```

### Option B: docker run (manual)

```bash
# 1. Create a volume for persistent data
docker volume create aih-data

# 2. Start backend
docker run -d \
  --name aih-backend \
  -p 5001:5001 \
  -e JWT_SECRET="your-strong-secret" \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="your-password" \
  -e DEFAULT_ENV_NAME="Production" \
  -e DEFAULT_APP_INSIGHTS_APP_ID="your-app-id" \
  -e DEFAULT_APP_INSIGHTS_API_KEY="your-api-key" \
  -e DEFAULT_SUBSCRIPTION_ID="your-sub-id" \
  -e DEFAULT_RESOURCE_GROUP="your-rg" \
  -v aih-data:/app/data \
  --restart unless-stopped \
  YOUR_DOCKERHUB/aih-backend:latest

# 3. Start frontend
docker run -d \
  --name aih-frontend \
  -p 3001:80 \
  -e API_PROTOCOL="http" \
  -e API_HOSTNAME="192.168.1.100" \
  -e API_PORT="5001" \
  --restart unless-stopped \
  YOUR_DOCKERHUB/aih-frontend:latest
```

---

## Step 3 — Access the app

Open: `http://YOUR_SERVER_IP:3001`

Login with the credentials you set in `ADMIN_PASSWORD`.

---

## Adding Azure environments via UI

After login, go to **Environments** in the sidebar and click **+ New**.

Fill in:
- **Subscription ID** — from Azure Portal → Subscriptions
- **Resource Group** — the RG containing your App Insights
- **App Insights App ID** — App Insights → Configure → API Access
- **App Insights API Key** — App Insights → Configure → API Access → Create API key

Click **Test Connection** to verify, then **Save Environment**.

The dashboard will immediately start showing data for that environment.

---

## Port customization examples

### Frontend on port 8080, backend on port 9000

```bash
# Backend
docker run -d --name aih-backend -p 9000:5001 \
  -e JWT_SECRET="secret" -e ADMIN_PASSWORD="pass" \
  -v aih-data:/app/data \
  YOUR_DOCKERHUB/aih-backend:latest

# Frontend — tell it the backend is on port 9000
docker run -d --name aih-frontend -p 8080:80 \
  -e API_HOSTNAME="192.168.1.100" \
  -e API_PORT="9000" \
  YOUR_DOCKERHUB/aih-frontend:latest
```

Open: `http://192.168.1.100:8080`

### Backend on a different server

```bash
# Backend server (192.168.1.200)
docker run -d --name aih-backend -p 5001:5001 \
  -e JWT_SECRET="secret" -e ADMIN_PASSWORD="pass" \
  -v aih-data:/app/data \
  YOUR_DOCKERHUB/aih-backend:latest

# Frontend server (192.168.1.100) — points to backend server
docker run -d --name aih-frontend -p 3001:80 \
  -e API_HOSTNAME="192.168.1.200" \
  -e API_PORT="5001" \
  YOUR_DOCKERHUB/aih-frontend:latest
```

### HTTPS setup (with reverse proxy)

Put nginx/traefik in front and set:
```bash
-e API_PROTOCOL="https"
-e API_HOSTNAME="api.yourdomain.com"
-e API_PORT="443"
```

---

## Environment variables reference

### Backend container

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | Random string for signing auth tokens |
| `ADMIN_USERNAME` | ✅ | Login username (default: `admin`) |
| `ADMIN_PASSWORD` | ✅ | Login password |
| `DEFAULT_ENV_NAME` | Optional | Pre-seed environment name |
| `DEFAULT_APP_INSIGHTS_APP_ID` | Optional | Pre-seed App Insights App ID |
| `DEFAULT_APP_INSIGHTS_API_KEY` | Optional | Pre-seed App Insights API Key |
| `DEFAULT_SUBSCRIPTION_ID` | Optional | Pre-seed Azure Subscription ID |
| `DEFAULT_RESOURCE_GROUP` | Optional | Pre-seed Resource Group |

### Frontend container

| Variable | Required | Description |
|---|---|---|
| `API_PROTOCOL` | ✅ | `http` or `https` |
| `API_HOSTNAME` | ✅ | IP or hostname of the backend server |
| `API_PORT` | ✅ | Port the backend is listening on |

---

## Data persistence

The backend stores all environment configurations in a SQLite database at `/app/data/environments.db`.

**Always mount a volume** to persist this across container restarts:

```bash
-v aih-data:/app/data          # named volume
# or
-v /host/path/data:/app/data   # bind mount
```

Without a volume, all configured environments are lost when the container restarts.

---

## Updating to a new version

```bash
docker pull YOUR_DOCKERHUB/aih-backend:latest
docker pull YOUR_DOCKERHUB/aih-frontend:latest

docker stop aih-backend aih-frontend
docker rm aih-backend aih-frontend

# Re-run with same commands as above
# The volume keeps all your environment configs
```
