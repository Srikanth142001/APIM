# App Insights Dashboard

A modern React-based dashboard for monitoring application insights, API performance, and infrastructure metrics.

## Features

- Real-time API monitoring
- MySQL connection tracking
- Response time analysis
- Error rate monitoring
- Modern glassmorphism UI design
- Configurable API endpoints

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Endpoint

Copy the example environment file and update with your API server details:

```bash
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_API_HOSTNAME=your-hostname-or-ip
REACT_APP_API_PORT=5000
REACT_APP_API_PROTOCOL=http
```

See [CONFIG.md](CONFIG.md) for detailed configuration options.

### 3. Start Development Server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Configuration

The dashboard can be configured in two ways:

1. **Environment Variables** (Recommended) - Edit `.env` file
2. **Direct Configuration** - Edit `src/config/apiConfig.js`

For detailed configuration instructions, see [CONFIG.md](CONFIG.md).

## Available Scripts

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.

## Production Deployment

### Build with Environment Variables

```bash
REACT_APP_API_HOSTNAME=api.example.com \
REACT_APP_API_PORT=443 \
REACT_APP_API_PROTOCOL=https \
npm run build
```

### Docker Deployment

```bash
docker build -t app-insights-dashboard .
docker run -p 80:80 \
  -e REACT_APP_API_HOSTNAME=api.example.com \
  -e REACT_APP_API_PORT=443 \
  -e REACT_APP_API_PROTOCOL=https \
  app-insights-dashboard
```

## Project Structure

```
app-insights-dashboard/
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── card.jsx
│   │       └── DashboardTable.jsx
│   ├── config/
│   │   └── apiConfig.js          # API configuration
│   ├── pages/
│   │   ├── Dashboard.js           # Main dashboard
│   │   ├── MySQLConnectionsCard.js
│   │   ├── ClusterHealthMonitor.js
│   │   └── NodeCpuOverview.js
│   ├── App.js
│   └── index.js
├── .env                           # Environment configuration
├── .env.example                   # Example environment file
├── CONFIG.md                      # Configuration guide
└── README.md
```

## API Endpoints

The dashboard connects to the following backend endpoints:

- `/api/overview` - Overview statistics
- `/api/response-time-chart` - Response time data
- `/api/top-apis` - Top performing APIs
- `/api/failures` - Failure tracking
- `/api/request-rate` - Request rate metrics
- `/api/response-percentiles` - Response time percentiles
- `/api/exceptions` - Exception tracking
- `/api/dependencies` - Dependency monitoring
- `/api/responseCompare` - Response comparison
- `/mysqlConnections` - MySQL connection metrics

## Troubleshooting

### API Connection Issues

1. Verify the API hostname/IP in `.env`
2. Check that the backend server is running
3. Ensure CORS is configured on the backend
4. Verify the protocol (http vs https)

### Environment Variables Not Working

1. Restart the development server after changing `.env`
2. Ensure variables start with `REACT_APP_`
3. For production, set variables before building

For more troubleshooting tips, see [CONFIG.md](CONFIG.md).

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://reactjs.org/)
- [Configuration Guide](CONFIG.md)

