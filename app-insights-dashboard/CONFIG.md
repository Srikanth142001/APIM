# API Configuration Guide

This document explains how to configure the API endpoint for the App Insights Dashboard.

## Configuration Methods

There are two ways to configure the API endpoint:

### Method 1: Environment Variables (Recommended)

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your values:
   ```env
   REACT_APP_API_HOSTNAME=your-hostname-or-ip
   REACT_APP_API_PORT=5000
   REACT_APP_API_PROTOCOL=http
   ```

3. Restart the development server:
   ```bash
   npm start
   ```

**Note:** The `.env` file is gitignored by default, so your local configuration won't be committed.

### Method 2: Direct Configuration

Edit the `src/config/apiConfig.js` file directly:

```javascript
const API_CONFIG = {
  hostname: 'your-hostname-or-ip',
  port: '5000',
  protocol: 'http',
};
```

## Configuration Options

### hostname
- **Type:** String
- **Default:** `172.16.11.241`
- **Description:** The hostname or IP address of your backend API server
- **Examples:**
  - `localhost`
  - `192.168.1.100`
  - `api.example.com`

### port
- **Type:** String
- **Default:** `5000`
- **Description:** The port number where your backend API is running
- **Examples:**
  - `5000`
  - `8080`
  - `3001`

### protocol
- **Type:** String
- **Default:** `http`
- **Description:** The protocol to use for API requests
- **Options:**
  - `http` - For local development or non-SSL environments
  - `https` - For production environments with SSL

## Environment-Specific Configuration

### Development
```env
REACT_APP_API_HOSTNAME=localhost
REACT_APP_API_PORT=5000
REACT_APP_API_PROTOCOL=http
```

### Staging
```env
REACT_APP_API_HOSTNAME=staging-api.example.com
REACT_APP_API_PORT=443
REACT_APP_API_PROTOCOL=https
```

### Production
```env
REACT_APP_API_HOSTNAME=api.example.com
REACT_APP_API_PORT=443
REACT_APP_API_PROTOCOL=https
```

## Docker Configuration

When using Docker, you can pass environment variables at runtime:

```bash
docker run -e REACT_APP_API_HOSTNAME=api.example.com \
           -e REACT_APP_API_PORT=5000 \
           -e REACT_APP_API_PROTOCOL=https \
           -p 3000:80 app-insights-dashboard
```

Or use a docker-compose.yml:

```yaml
version: '3.8'
services:
  dashboard:
    image: app-insights-dashboard
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_HOSTNAME=api.example.com
      - REACT_APP_API_PORT=5000
      - REACT_APP_API_PROTOCOL=https
```

## Build-Time Configuration

For production builds, environment variables must be set before building:

```bash
# Set environment variables
export REACT_APP_API_HOSTNAME=api.example.com
export REACT_APP_API_PORT=443
export REACT_APP_API_PROTOCOL=https

# Build the application
npm run build
```

Or inline:

```bash
REACT_APP_API_HOSTNAME=api.example.com \
REACT_APP_API_PORT=443 \
REACT_APP_API_PROTOCOL=https \
npm run build
```

## API Endpoints

The following endpoints are configured automatically based on your settings:

| Endpoint | Path |
|----------|------|
| Overview | `/api/overview?range={range}` |
| Response Time Chart | `/api/response-time-chart?range={range}` |
| Top APIs | `/api/top-apis?range={range}` |
| Failures | `/api/failures?range={range}` |
| Request Rate | `/api/request-rate?range={range}` |
| Response Percentiles | `/api/response-percentiles` |
| Exceptions | `/api/exceptions` |
| Dependencies | `/api/dependencies` |
| Response Compare | `/api/responseCompare` |
| MySQL Connections | `/mysqlConnections` |

## Troubleshooting

### API calls failing
1. Check that the hostname/IP is correct
2. Verify the port number
3. Ensure the backend server is running
4. Check CORS settings on the backend
5. Verify protocol (http vs https)

### Environment variables not working
1. Ensure the `.env` file is in the root directory
2. Restart the development server after changing `.env`
3. Check that variable names start with `REACT_APP_`
4. For production builds, set variables before building

### CORS errors
If you see CORS errors, configure your backend to allow requests from your frontend domain:

```javascript
// Express.js example
app.use(cors({
  origin: 'http://localhost:3000', // Your frontend URL
  credentials: true
}));
```

## Security Notes

1. **Never commit `.env` files** with production credentials to version control
2. Use **HTTPS in production** to encrypt API communications
3. Consider using **API keys or tokens** for authentication
4. Implement **rate limiting** on your backend API
5. Use **environment-specific configurations** for different deployment stages
