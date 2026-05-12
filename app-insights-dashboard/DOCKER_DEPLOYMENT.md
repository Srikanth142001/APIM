# Docker Deployment Guide - Dynamic Port Configuration

This guide explains how to run the App Insights Dashboard with dynamic port configuration using Docker.

## Quick Start

### Method 1: Using Docker Compose (Recommended)

#### Default Port (3000)
```bash
docker-compose up -d
```

#### Custom Port (e.g., 8080)
```bash
PORT=8080 HOST_PORT=8080 docker-compose up -d
```

#### Using .env.docker file
```bash
# Edit .env.docker file with your desired ports
docker-compose --env-file .env.docker up -d
```

### Method 2: Using Docker Run

#### Build the image
```bash
docker build -t app-insights-dashboard .
```

#### Run on default port 80 (mapped to host 3000)
```bash
docker run -d -p 3000:80 --name app-insights-dashboard app-insights-dashboard
```

#### Run on custom port 8080 (both container and host)
```bash
docker run -d -p 8080:8080 -e PORT=8080 --name app-insights-dashboard app-insights-dashboard
```

#### Run on port 5000 inside container, mapped to 9000 on host
```bash
docker run -d -p 9000:5000 -e PORT=5000 --name app-insights-dashboard app-insights-dashboard
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port inside the container where nginx listens | `80` |
| `HOST_PORT` | Port on the host machine (docker-compose only) | `3000` |

### Port Configuration Examples

#### Example 1: Run on port 4000
```bash
# Using docker-compose
PORT=4000 HOST_PORT=4000 docker-compose up -d

# Using docker run
docker run -d -p 4000:4000 -e PORT=4000 --name app-insights-dashboard app-insights-dashboard
```

#### Example 2: Container port 80, Host port 8080
```bash
# Using docker-compose
PORT=80 HOST_PORT=8080 docker-compose up -d

# Using docker run
docker run -d -p 8080:80 --name app-insights-dashboard app-insights-dashboard
```

#### Example 3: Multiple instances on different ports
```bash
# Instance 1 on port 3000
docker run -d -p 3000:80 --name dashboard-3000 app-insights-dashboard

# Instance 2 on port 4000
docker run -d -p 4000:80 --name dashboard-4000 app-insights-dashboard

# Instance 3 on port 5000
docker run -d -p 5000:80 --name dashboard-5000 app-insights-dashboard
```

## Docker Commands

### Build
```bash
# Build the image
docker build -t app-insights-dashboard .

# Build with custom tag
docker build -t app-insights-dashboard:v1.0 .
```

### Run
```bash
# Start container
docker-compose up -d

# Start with specific port
PORT=8080 HOST_PORT=8080 docker-compose up -d

# View logs
docker-compose logs -f

# Stop container
docker-compose down

# Restart container
docker-compose restart
```

### Manage
```bash
# List running containers
docker ps

# Stop container
docker stop app-insights-dashboard

# Start container
docker start app-insights-dashboard

# Remove container
docker rm app-insights-dashboard

# View logs
docker logs app-insights-dashboard

# Follow logs
docker logs -f app-insights-dashboard

# Execute command in container
docker exec -it app-insights-dashboard sh
```

### Clean Up
```bash
# Remove container
docker-compose down

# Remove container and volumes
docker-compose down -v

# Remove image
docker rmi app-insights-dashboard

# Clean up all unused resources
docker system prune -a
```

## Testing

### Test the application
```bash
# After starting the container, test the endpoint
curl http://localhost:3000

# Or open in browser
# Windows
start http://localhost:3000

# Test with custom port
curl http://localhost:8080
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :3000

# Use a different port
PORT=4000 HOST_PORT=4000 docker-compose up -d
```

### Container Won't Start
```bash
# Check logs
docker logs app-insights-dashboard

# Check nginx configuration
docker exec app-insights-dashboard cat /etc/nginx/conf.d/default.conf

# Verify port environment variable
docker exec app-insights-dashboard env | grep PORT
```

### Rebuild After Changes
```bash
# Rebuild and restart
docker-compose up -d --build

# Force rebuild
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

### Using Docker Compose in Production
```bash
# Create production docker-compose file
cp docker-compose.yml docker-compose.prod.yml

# Edit docker-compose.prod.yml with production settings
# Then deploy:
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Configuration
```bash
# Development
docker-compose --env-file .env.docker up -d

# Staging
docker-compose --env-file .env.staging up -d

# Production
docker-compose --env-file .env.production up -d
```

## Advanced Configuration

### Custom Nginx Configuration
If you need to modify nginx settings, edit `nginx.conf.template`:

```nginx
server {
    listen ${PORT};
    
    # Add your custom configuration here
    client_max_body_size 10M;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Health Check
Add health check to docker-compose.yml:

```yaml
services:
  app-insights-dashboard:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:${PORT:-80}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Build and Push Docker Image
  run: |
    docker build -t app-insights-dashboard:${{ github.sha }} .
    docker tag app-insights-dashboard:${{ github.sha }} app-insights-dashboard:latest
    
- name: Deploy with Custom Port
  run: |
    docker run -d -p 8080:8080 -e PORT=8080 app-insights-dashboard:latest
```

## Security Considerations

1. **Don't expose unnecessary ports** - Only map the ports you need
2. **Use environment variables** - Never hardcode sensitive data
3. **Keep images updated** - Regularly update base images
4. **Use non-root user** - Consider adding a non-root user in Dockerfile
5. **Enable HTTPS** - Use a reverse proxy like Traefik or nginx-proxy for SSL

## Support

For issues or questions:
- Check container logs: `docker logs app-insights-dashboard`
- Verify nginx config: `docker exec app-insights-dashboard cat /etc/nginx/conf.d/default.conf`
- Test port binding: `docker port app-insights-dashboard`
