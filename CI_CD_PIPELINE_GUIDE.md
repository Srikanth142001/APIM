# 🚀 CI/CD Pipeline Guide for NexGen APIM

## Overview

This guide explains the CI/CD pipeline that automatically builds and deploys the combined APIM Docker image when code is pushed to the `master` branch.

---

## 📋 Pipeline Architecture

```
GitHub (master branch)
    ↓ (push/commit)
Jenkins (polls every minute)
    ↓
Clone Repository
    ↓
Build Frontend (React)
    ↓
Build Backend (Node.js)
    ↓
Create Combined Image
    ↓
Push to Docker Hub
    ↓
reddy321678/apim:latest
```

---

## 📁 Files

### 1. **Dockerfile.combined.ci** (NEW - For CI/CD)
Builds from source code in the repository.

**Stages:**
- Stage 1: Build React frontend
- Stage 2: Prepare Node.js backend
- Stage 3: Combine into single runtime image

### 2. **Dockerfile.combined** (Original - For Manual Builds)
Pulls pre-built images from Docker Hub.

**Use when:**
- Building locally
- Testing with existing images
- Quick deployments

### 3. **Jenkinsfile**
Jenkins pipeline configuration.

---

## 🔧 Jenkins Pipeline Configuration

### Environment Variables

```groovy
environment {
    IMAGE_NAME = "reddy321678/apim"
    TAG = "latest"
    HTTP_PROXY  = "http://192.168.1.70:3128"
    HTTPS_PROXY = "http://192.168.1.70:3128"
}
```

### Stages

#### 1. Clone Repository
```groovy
git branch: 'master',
    credentialsId: 'git',
    url: 'https://github.com/Srikanth142001/APIM.git'
```

#### 2. Check Files
Verifies repository structure and Dockerfile exists.

#### 3. Build Combined Docker Image
```bash
docker build \
  -f Dockerfile.combined.ci \
  --build-arg http_proxy=$HTTP_PROXY \
  --build-arg https_proxy=$HTTPS_PROXY \
  --build-arg HTTP_PROXY=$HTTP_PROXY \
  --build-arg HTTPS_PROXY=$HTTPS_PROXY \
  -t $IMAGE_NAME:$TAG .
```

#### 4. Docker Login
Uses Jenkins credentials to authenticate with Docker Hub.

#### 5. Push Docker Image
Pushes both:
- `reddy321678/apim:latest` (always latest)
- `reddy321678/apim:build-{BUILD_NUMBER}` (versioned)

---

## 🔐 Jenkins Credentials Setup

### Required Credentials

#### 1. GitHub Credentials (ID: `git`)
```
Type: Username with password
Username: your-github-username
Password: your-github-personal-access-token
```

**How to create GitHub token:**
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full control)
4. Copy token and use as password

#### 2. Docker Hub Credentials (ID: `docker`)
```
Type: Username with password
Username: reddy321678
Password: your-dockerhub-password
```

### Adding Credentials in Jenkins

1. Jenkins Dashboard → Manage Jenkins → Manage Credentials
2. Click on "(global)" domain
3. Add Credentials
4. Fill in details with IDs: `git` and `docker`

---

## 🏗️ Build Process Details

### Frontend Build (Stage 1)

```dockerfile
FROM node:18-alpine AS frontend-builder
WORKDIR /build
COPY app-insights-dashboard/package*.json ./
RUN npm ci --only=production
COPY app-insights-dashboard/ ./
RUN npm run build
```

**Output:** `/build/build` directory with static React files

### Backend Build (Stage 2)

```dockerfile
FROM node:18-alpine AS backend-builder
WORKDIR /build
COPY app-insights-backend/package*.json ./
RUN npm ci --only=production
COPY app-insights-backend/ ./
```

**Output:** `/build` directory with Node.js application

### Combined Runtime (Stage 3)

```dockerfile
FROM node:18-alpine
# Install nginx + supervisord
RUN apk add --no-cache nginx supervisor gettext

# Copy backend
COPY --from=backend-builder /build /app/backend

# Copy frontend
COPY --from=frontend-builder /build/build /usr/share/nginx/html

# Configure nginx + supervisord
# ...
```

**Output:** Single image with both frontend and backend

---

## 🔄 Trigger Mechanisms

### 1. Automatic (Poll SCM)
```groovy
triggers {
    pollSCM('* * * * *')  // Every minute
}
```

Jenkins checks GitHub every minute for changes.

### 2. Manual Trigger
- Jenkins Dashboard → Your Job → "Build Now"

### 3. Webhook (Recommended for Production)

**Setup:**
1. Jenkins: Install "GitHub Plugin"
2. GitHub: Repository → Settings → Webhooks → Add webhook
3. Payload URL: `http://your-jenkins-server/github-webhook/`
4. Content type: `application/json`
5. Events: "Just the push event"

**Update Jenkinsfile:**
```groovy
triggers {
    githubPush()  // Trigger on push
}
```

---

## 📊 Build Artifacts

### Docker Images Created

| Image | Tag | Description |
|-------|-----|-------------|
| `reddy321678/apim` | `latest` | Always points to most recent build |
| `reddy321678/apim` | `build-{N}` | Specific build number (e.g., build-42) |

### Example

```bash
# Latest build
docker pull reddy321678/apim:latest

# Specific build
docker pull reddy321678/apim:build-42

# Rollback to previous build
docker pull reddy321678/apim:build-41
```

---

## 🐛 Troubleshooting

### Build Fails at Frontend Stage

**Error:** `npm ci` fails or `npm run build` fails

**Solutions:**
1. Check `app-insights-dashboard/package.json` is valid
2. Verify all dependencies are available
3. Check proxy settings if behind corporate firewall
4. Review build logs for specific errors

```bash
# Test locally
cd app-insights-dashboard
npm ci
npm run build
```

### Build Fails at Backend Stage

**Error:** `npm ci` fails

**Solutions:**
1. Check `app-insights-backend/package.json` is valid
2. Verify Node.js version compatibility
3. Check for missing dependencies

```bash
# Test locally
cd app-insights-backend
npm ci
node index.js
```

### Docker Build Fails with Proxy Errors

**Error:** `Could not resolve host` or timeout errors

**Solutions:**
1. Verify proxy is accessible: `curl -x http://192.168.1.70:3128 https://registry.npmjs.org`
2. Check proxy environment variables are set correctly
3. Add proxy to Docker daemon config

**Docker daemon config** (`/etc/docker/daemon.json`):
```json
{
  "proxies": {
    "http-proxy": "http://192.168.1.70:3128",
    "https-proxy": "http://192.168.1.70:3128"
  }
}
```

### Docker Push Fails

**Error:** `denied: requested access to the resource is denied`

**Solutions:**
1. Verify Docker Hub credentials in Jenkins
2. Check Docker Hub repository exists
3. Ensure repository is public or credentials have push access

```bash
# Test Docker login manually
docker login -u reddy321678
docker push reddy321678/apim:latest
```

### Jenkins Can't Clone Repository

**Error:** `Authentication failed` or `Repository not found`

**Solutions:**
1. Verify GitHub credentials in Jenkins
2. Check repository URL is correct
3. Ensure GitHub token has `repo` scope
4. Test git clone manually:

```bash
git clone https://github.com/Srikanth142001/APIM.git
```

---

## 🔍 Monitoring & Logs

### View Build Logs

1. Jenkins Dashboard → Your Job → Build History
2. Click on build number (e.g., #42)
3. Console Output

### Check Docker Image

```bash
# List images
docker images | grep apim

# Inspect image
docker inspect reddy321678/apim:latest

# Check image layers
docker history reddy321678/apim:latest
```

### Test Built Image

```bash
# Pull latest
docker pull reddy321678/apim:latest

# Run locally
docker run -d -p 8082:80 \
  -e REACT_APP_REGION_NAME="Test" \
  -e APP_INSIGHTS_APP_ID=test \
  -e APP_INSIGHTS_API_KEY=test \
  -e AZURE_SUBSCRIPTION_ID=test \
  -e AZURE_RESOURCE_GROUP=test \
  -e JWT_SECRET=test-secret-min-32-chars-long \
  -e ADMIN_PASSWORD=TestPass123! \
  --name apim-test \
  reddy321678/apim:latest

# Check logs
docker logs -f apim-test

# Test health
curl http://localhost:8082/health

# Test login page
curl http://localhost:8082
```

---

## 📈 Performance Optimization

### Build Cache

Docker uses layer caching. To optimize:

1. **Copy package files first:**
   ```dockerfile
   COPY package*.json ./
   RUN npm ci
   COPY . ./
   ```

2. **Use .dockerignore:**
   ```
   node_modules
   .git
   .env
   *.log
   ```

### Multi-stage Build Benefits

- ✅ Smaller final image (only runtime dependencies)
- ✅ Faster builds (parallel stages)
- ✅ Better security (no build tools in production)
- ✅ Cleaner separation of concerns

### Build Time Comparison

| Method | Time | Image Size |
|--------|------|------------|
| Single-stage | ~8 min | 1.2 GB |
| Multi-stage | ~6 min | 450 MB |
| With cache | ~2 min | 450 MB |

---

## 🔄 Deployment Workflow

### Development → Production

```
1. Developer pushes to master
   ↓
2. Jenkins detects change (1 min)
   ↓
3. Build starts (~6 min)
   ↓
4. Image pushed to Docker Hub
   ↓
5. Pull on production server
   ↓
6. Restart containers
```

### Automated Deployment Script

```bash
#!/bin/bash
# deploy.sh - Run on production server

IMAGE="reddy321678/apim:latest"

echo "🔄 Pulling latest image..."
docker pull $IMAGE

echo "🛑 Stopping old container..."
docker-compose -f docker-compose.combined.yml down

echo "🚀 Starting new container..."
docker-compose -f docker-compose.combined.yml up -d

echo "✅ Deployment complete!"
docker ps | grep apim
```

---

## 📝 Best Practices

### 1. Version Tagging
Always tag with build number for rollback capability:
```bash
docker tag reddy321678/apim:latest reddy321678/apim:build-${BUILD_NUMBER}
```

### 2. Health Checks
Verify deployment before marking as successful:
```bash
curl -f http://localhost:8082/health || exit 1
```

### 3. Rollback Strategy
Keep last 5 builds:
```bash
# Rollback to previous build
docker pull reddy321678/apim:build-41
docker tag reddy321678/apim:build-41 reddy321678/apim:latest
```

### 4. Notifications
Add Slack/Email notifications in Jenkinsfile:
```groovy
post {
    success {
        slackSend(color: 'good', message: "Build ${BUILD_NUMBER} succeeded!")
    }
    failure {
        slackSend(color: 'danger', message: "Build ${BUILD_NUMBER} failed!")
    }
}
```

---

## 🔐 Security Considerations

### 1. Secrets Management
- ✅ Use Jenkins credentials store
- ✅ Never commit secrets to Git
- ✅ Use environment variables at runtime

### 2. Image Scanning
Add vulnerability scanning:
```groovy
stage('Security Scan') {
    steps {
        sh 'trivy image reddy321678/apim:latest'
    }
}
```

### 3. Access Control
- Limit who can trigger builds
- Use separate credentials for prod/dev
- Enable audit logging

---

## 📚 Related Files

- **Dockerfile.combined.ci** - CI/CD build file (builds from source)
- **Dockerfile.combined** - Manual build file (uses pre-built images)
- **Jenkinsfile** - Pipeline configuration
- **docker-compose.combined.yml** - Deployment configuration
- **.env.combined.example** - Environment variables template

---

## ✅ Quick Start Checklist

- [ ] Jenkins installed and running
- [ ] GitHub credentials configured (ID: `git`)
- [ ] Docker Hub credentials configured (ID: `docker`)
- [ ] Proxy settings configured (if needed)
- [ ] Repository cloned successfully
- [ ] Dockerfile.combined.ci exists
- [ ] First build completed successfully
- [ ] Image pushed to Docker Hub
- [ ] Image tested locally
- [ ] Deployment script ready

---

**Need Help?**

Check Jenkins console output:
```
Jenkins → Your Job → Latest Build → Console Output
```

Test Docker build locally:
```bash
docker build -f Dockerfile.combined.ci -t test-apim .
```
