# Azure Insights Hub

Plug-and-play Azure monitoring dashboard. Connect any Azure environment in minutes.

## Quick Start

1. Copy `.env.example` to `.env` and set your admin password:
   ```bash
   cp azure-insights-hub/backend/.env.example azure-insights-hub/.env
   ```

2. Edit `.env`:
   ```
   JWT_SECRET=your-strong-random-secret
   ADMIN_PASSWORD=your-secure-password
   ```

3. Run with Docker Compose:
   ```bash
   cd azure-insights-hub
   docker-compose up
   ```

4. Open: http://localhost:3001

5. Login → Go to **Environments** → Add your Azure credentials

6. Dashboard populates automatically

## What You Need

- **Azure Subscription ID** — from Azure Portal → Subscriptions
- **Resource Group name** — the RG containing your App Insights resource
- **App Insights App ID** — from App Insights → Configure → API Access
- **App Insights API Key** — from App Insights → Configure → API Access → Create API key
- **Service Principal** (optional) — for AKS/MySQL/Log Analytics data

## Creating a Service Principal

```bash
az ad sp create-for-rbac --name "azure-insights-hub" --role Reader \
  --scopes /subscriptions/{your-subscription-id}
```

This outputs `appId` (Client ID), `password` (Client Secret), and `tenant` (Tenant ID).

## Development Setup

### Backend
```bash
cd azure-insights-hub/backend
cp .env.example .env
# Edit .env with your values
npm install
npm start
```

### Frontend
```bash
cd azure-insights-hub/frontend
cp .env.example .env
npm install
npm start
```

## Architecture

```
azure-insights-hub/
├── backend/          Node.js Express API
│   ├── db.js         SQLite environment store
│   ├── index.js      Main server
│   ├── middleware/   JWT auth
│   ├── routes/       API routes
│   └── services/     Azure token manager + App Insights client
├── frontend/         React app
│   └── src/
│       ├── pages/    Login, Setup, Dashboard
│       ├── components/ Sidebar
│       └── config/   API config + axios setup
└── docker-compose.yml
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/verify | Verify token |
| GET | /api/environments | List environments |
| POST | /api/environments | Create environment |
| PUT | /api/environments/:id | Update environment |
| DELETE | /api/environments/:id | Delete environment |
| POST | /api/environments/test | Test Azure connection |
| POST | /api/environments/discover | Auto-discover resources |
| GET | /api/:envId/overview | Overview metrics |
| GET | /api/:envId/top-apis | Top APIs |
| GET | /api/:envId/failures | Failed requests |
| GET | /api/:envId/request-rate | Request rate over time |
| GET | /api/:envId/performance/timeline | Performance timeline |
| GET | /api/:envId/performance/operations | Per-operation metrics |
| GET | /api/:envId/performance/detail | Operation detail |
| GET | /api/:envId/failures-panel/timeline | Failures timeline |
| GET | /api/:envId/failures-panel/operations | Failures by operation |
| GET | /api/:envId/api-search | Search APIs |
