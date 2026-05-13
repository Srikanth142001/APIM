# 🔄 Jenkins Pipeline Update Instructions

## Quick Update

Your Jenkins pipeline needs to use the new `Dockerfile.combined.ci` instead of `Dockerfile.combined`.

---

## ✅ Option 1: Use Jenkinsfile (Recommended)

### Step 1: Update Jenkins Job

1. Go to Jenkins Dashboard
2. Click on your APIM job
3. Click "Configure"
4. Scroll to "Pipeline" section
5. Change "Definition" to: **Pipeline script from SCM**
6. SCM: **Git**
7. Repository URL: `https://github.com/Srikanth142001/APIM.git`
8. Credentials: Select your `git` credentials
9. Branch: `*/master`
10. Script Path: `Jenkinsfile`
11. Click "Save"

**Done!** Jenkins will now use the Jenkinsfile from your repository.

---

## ✅ Option 2: Update Existing Pipeline Script

If you prefer to keep the pipeline script in Jenkins UI:

### Replace Your Current Pipeline With:

```groovy
pipeline {
    agent any
    
    triggers {
        pollSCM('* * * * *')
    }
    
    environment {
        IMAGE_NAME = "reddy321678/apim"
        TAG = "latest"
        HTTP_PROXY  = "http://192.168.1.70:3128"
        HTTPS_PROXY = "http://192.168.1.70:3128"
    }
    
    stages {
        stage('Clone Repository') {
            steps {
                git branch: 'master',
                    credentialsId: 'git',
                    url: 'https://github.com/Srikanth142001/APIM.git'
            }
        }
        
        stage('Check Files') {
            steps {
                sh 'ls -lrt'
                sh 'echo "Checking Dockerfile..."'
                sh 'ls -l Dockerfile.combined.ci'
            }
        }
        
        stage('Build Combined Docker Image') {
            steps {
                sh '''
                    docker build \
                      -f Dockerfile.combined.ci \
                      --build-arg http_proxy=$HTTP_PROXY \
                      --build-arg https_proxy=$HTTPS_PROXY \
                      --build-arg HTTP_PROXY=$HTTP_PROXY \
                      --build-arg HTTPS_PROXY=$HTTPS_PROXY \
                      -t $IMAGE_NAME:$TAG .
                '''
            }
        }
        
        stage('Docker Login') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                    '''
                }
            }
        }
        
        stage('Push Docker Image') {
            steps {
                sh '''
                    docker push $IMAGE_NAME:$TAG
                '''
            }
        }
        
        stage('Tag with Build Number') {
            steps {
                sh '''
                    docker tag $IMAGE_NAME:$TAG $IMAGE_NAME:build-${BUILD_NUMBER}
                    docker push $IMAGE_NAME:build-${BUILD_NUMBER}
                '''
            }
        }
    }
    
    post {
        success {
            echo '✅ APIM combined frontend + backend image pushed successfully!'
            echo "Image: ${IMAGE_NAME}:${TAG}"
            echo "Build: ${IMAGE_NAME}:build-${BUILD_NUMBER}"
        }
        failure {
            echo '❌ APIM pipeline failed!'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
```

---

## 🔑 Key Changes

### 1. Dockerfile Name
**Old:** `-f Dockerfile.combined`  
**New:** `-f Dockerfile.combined.ci`

### 2. Build Process
**Old:** Pulls pre-built images from Docker Hub  
**New:** Builds from source code in repository

### 3. Additional Stage
**New:** "Tag with Build Number" stage for versioning

---

## 🧪 Test the Pipeline

### Step 1: Trigger Build

1. Jenkins Dashboard → Your Job → "Build Now"
2. Watch Console Output

### Step 2: Verify Build

```bash
# Check if image was pushed
docker pull reddy321678/apim:latest

# Check versioned image
docker pull reddy321678/apim:build-1

# Run locally to test
docker run -d -p 8082:80 \
  -e REACT_APP_REGION_NAME="Test" \
  -e APP_INSIGHTS_APP_ID=test \
  -e APP_INSIGHTS_API_KEY=test \
  -e AZURE_SUBSCRIPTION_ID=test \
  -e AZURE_RESOURCE_GROUP=test \
  -e JWT_SECRET=test-secret-minimum-32-characters \
  -e ADMIN_PASSWORD=TestPass123! \
  reddy321678/apim:latest

# Test health
curl http://localhost:8082/health

# Test login page
curl http://localhost:8082
```

---

## 📊 Expected Build Output

```
[Pipeline] Start of Pipeline
[Pipeline] node
[Pipeline] {
[Pipeline] stage (Clone Repository)
[Pipeline] { (Clone Repository)
[Pipeline] git
Cloning repository https://github.com/Srikanth142001/APIM.git
Checking out Revision abc123...
[Pipeline] }
[Pipeline] stage (Check Files)
[Pipeline] { (Check Files)
+ ls -lrt
+ ls -l Dockerfile.combined.ci
-rw-r--r-- 1 jenkins jenkins 5234 May 13 10:30 Dockerfile.combined.ci
[Pipeline] }
[Pipeline] stage (Build Combined Docker Image)
[Pipeline] { (Build Combined Docker Image)
+ docker build -f Dockerfile.combined.ci ...
Step 1/20 : FROM node:18-alpine AS frontend-builder
Step 2/20 : WORKDIR /build
...
Successfully built abc123def456
Successfully tagged reddy321678/apim:latest
[Pipeline] }
[Pipeline] stage (Docker Login)
[Pipeline] { (Docker Login)
Login Succeeded
[Pipeline] }
[Pipeline] stage (Push Docker Image)
[Pipeline] { (Push Docker Image)
The push refers to repository [docker.io/reddy321678/apim]
latest: digest: sha256:abc123... size: 1234
[Pipeline] }
[Pipeline] stage (Tag with Build Number)
[Pipeline] { (Tag with Build Number)
build-1: digest: sha256:abc123... size: 1234
[Pipeline] }
✅ APIM combined frontend + backend image pushed successfully!
Image: reddy321678/apim:latest
Build: reddy321678/apim:build-1
[Pipeline] End of Pipeline
Finished: SUCCESS
```

---

## 🐛 Troubleshooting

### Build Fails: "Dockerfile.combined.ci not found"

**Cause:** Repository not cloned properly or file doesn't exist

**Solution:**
```bash
# Verify file exists in repo
git clone https://github.com/Srikanth142001/APIM.git
cd APIM
ls -l Dockerfile.combined.ci
```

### Build Fails: "npm ci failed"

**Cause:** Proxy issues or missing dependencies

**Solution:**
1. Check proxy is accessible
2. Verify package.json files are valid
3. Test locally:
   ```bash
   cd app-insights-dashboard
   npm ci
   npm run build
   ```

### Build Succeeds But Image Doesn't Work

**Cause:** Missing environment variables or backend fix not included

**Solution:**
1. Verify latest code is pulled:
   ```bash
   git log -1 --oneline
   # Should show: "Fix infinite redirect loop..."
   ```

2. Check backend has the fix:
   ```bash
   docker run --rm reddy321678/apim:latest cat /app/backend/index.js | grep -A 5 "api/features"
   ```

---

## 📝 Comparison: Old vs New

| Aspect | Old (Dockerfile.combined) | New (Dockerfile.combined.ci) |
|--------|---------------------------|------------------------------|
| **Source** | Pulls from Docker Hub | Builds from Git repo |
| **Build Time** | ~2 min | ~6 min |
| **Flexibility** | Requires pre-built images | Builds everything fresh |
| **CI/CD** | Not suitable | Perfect for CI/CD |
| **Updates** | Manual rebuild needed | Automatic on git push |
| **Versioning** | Manual tagging | Auto-tagged with build number |

---

## ✅ Post-Update Checklist

- [ ] Jenkins pipeline updated
- [ ] Test build triggered successfully
- [ ] Image pushed to Docker Hub
- [ ] Image tagged with build number
- [ ] Tested image locally
- [ ] Login page works (no blinking)
- [ ] Backend fix included (features endpoint public)
- [ ] Panels hide correctly based on env vars

---

## 🚀 Next Steps

1. **Update Jenkins** (use Option 1 or 2 above)
2. **Trigger a build** to test
3. **Deploy to production** once verified
4. **Monitor** first few builds
5. **Set up webhooks** for instant builds (optional)

---

**Questions?** Check `CI_CD_PIPELINE_GUIDE.md` for detailed documentation.
