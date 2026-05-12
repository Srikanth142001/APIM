# Multi-Instance Deployment Guide

This guide explains how to run multiple instances of the same Docker image with different configurations.

## Overview

You can now run the **same Docker image** on:
- **Different frontend ports** (runtime configurable)
- **Different backend API endpoints** (runtime configurable)
- **Different region names** (runtime configurable)

## How It Works

### Runtime Configuration
The application uses a special `config.js` file that gets updated at container startup with your environment variables. This means:
- ✅ **No rebuild required** to change API endpoint
- ✅ **No rebuild required** to change region name
- ✅ **No rebuild required** to change frontend port
- ✅ **One image, multiple deployments**

## Build Once

Build the Docker image once with default values:

```bash
cd app-insights-dashboard

docker build -t app-insights-dashboard:latest ^
  --build-arg REACT_APP_API_PROTOCOL=http ^
  --build-arg REACT_APP_API_HOSTNAME=172.30.38.193 ^
  --build-arg REACT_APP_API_PORT=5005 ^
  --build-arg REACT_APP_REGION_NAME="Default Region" ^
  .
```

## Run Multiple Instances

### Example 1: SAN Region on Port 8080

```bash
docker run -d ^
  -p 8080:8080 ^
  -e PORT=8080 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=172.30.38.193 ^
  -e REACT_APP_API_PORT=5005 ^
  -e REACT_APP_REGION_NAME="SAN Region" ^
  --name frontend_san ^
  app-insights-dashboard:latest
```

### Example 2: US East Region on Port 9090

```bash
docker run -d ^
  -p 9090:9090 ^
  -e PORT=9090 ^
  -e REACT_APP_API_PROTOCOL=http ^
  -e REACT_APP_API_HOSTNAME=10.20.30.40 ^
  -e REACT_APP_API_PORT=5006 ^
  -e REACT_APP_REGION_NAME="US East Region" ^
  --name frontend_useast ^
  app-insights-dashboard:latest
```

### Example 3: EU West Region on Port 7070

```bash
docker run -d ^
  -p 7070:7070 ^
  -e PORT=7070 ^
  -e REACT_APP_API_PROTOCOL=https ^
  -e REACT_APP_API_HOSTNAME=eu-api.example.com ^
  -e REACT_APP_API_PORT=443 ^
  -e REACT_APP_REGION_NAME="EU West Region" ^
  --name frontend_euwest ^
  app-insights-dashboard:latest
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Frontend container port | `80` | No |
| `REACT_APP_API_PROTOCOL` | Backend API protocol (http/https) | `http` | No |
| `REACT_APP_API_HOSTNAME` | Backend API hostname or IP | `172.30.38.193` | No |
| `REACT_APP_API_PORT` | Backend API port | `5005` | No |
| `REACT_APP_REGION_NAME` | Region name displayed in dashboard | `SAN Region` | No |

## Access Your Instances

After running the containers, access them at:

- **SAN Region**: http://localhost:8080
- **US East Region**: http://localhost:9090
- **EU West Region**: http://localhost:7070

## Verify Configuration

Check container logs to verify the configuration:

```bash
docker logs frontend_san
```

You should see output like:
```
==========================================
Starting App Insights Dashboard
==========================================
Container Port: 8080
API Endpoint: http://172.30.38.193:5005
Region: SAN Region
==========================================
```

## Stop and Remove Instances

```bash
# Stop containers
docker stop frontend_san frontend_useast frontend_euwest

# Remove containers
docker rm frontend_san frontend_useast frontend_euwest
```

## Docker Compose Example

Create a `docker-compose-multi.yml` file:

```yaml
version: '3.8'

services:
  frontend-san:
    image: app-insights-dashboard:latest
    container_name: frontend_san
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - REACT_APP_API_PROTOCOL=http
      - REACT_APP_API_HOSTNAME=172.30.38.193
      - REACT_APP_API_PORT=5005
      - REACT_APP_REGION_NAME=SAN Region
    restart: unless-stopped

  frontend-useast:
    image: app-insights-dashboard:latest
    container_name: frontend_useast
    ports:
      - "9090:9090"
    environment:
      - PORT=9090
      - REACT_APP_API_PROTOCOL=http
      - REACT_APP_API_HOSTNAME=10.20.30.40
      - REACT_APP_API_PORT=5006
      - REACT_APP_REGION_NAME=US East Region
    restart: unless-stopped

  frontend-euwest:
    image: app-insights-dashboard:latest
    container_name: frontend_euwest
    ports:
      - "7070:7070"
    environment:
      - PORT=7070
      - REACT_APP_API_PROTOCOL=https
      - REACT_APP_API_HOSTNAME=eu-api.example.com
      - REACT_APP_API_PORT=443
      - REACT_APP_REGION_NAME=EU West Region
    restart: unless-stopped
```

Run all instances:
```bash
docker-compose -f docker-compose-multi.yml up -d
```

## Important Notes

1. **Port Mapping**: The `-p HOST_PORT:CONTAINER_PORT` must match the `PORT` environment variable
   - ✅ Correct: `-p 8080:8080 -e PORT=8080`
   - ❌ Wrong: `-p 8080:80 -e PORT=8080` (mismatch)

2. **Unique Container Names**: Each instance must have a unique name
   - Use `--name frontend_san`, `--name frontend_useast`, etc.

3. **No Rebuild Required**: Once you build the image, you can deploy it anywhere with different configurations

4. **Region Name**: Will be displayed in the dashboard header

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs frontend_san

# Check if port is already in use
netstat -ano | findstr :8080
```

### Wrong API endpoint
```bash
# Check environment variables
docker exec frontend_san env | findstr REACT_APP

# Restart container with correct values
docker stop frontend_san
docker rm frontend_san
# Run again with correct -e values
```

### Dashboard shows wrong region
The region name is updated at runtime. If it's wrong:
1. Stop the container
2. Remove the container
3. Run again with correct `REACT_APP_REGION_NAME`

## Summary

✅ **Build once, deploy many times**
✅ **Runtime configuration** for API endpoint, port, and region
✅ **No code changes** needed for different environments
✅ **Easy to manage** multiple regions from one image
