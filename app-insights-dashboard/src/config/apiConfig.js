// API Configuration
// Change these values based on your environment
// You can also use environment variables by creating a .env file

// Runtime configuration support
// Check if runtime config is available (from public/config.js)
const getRuntimeConfig = () => {
  if (typeof window !== 'undefined' && window.ENV_CONFIG) {
    const hostname   = window.ENV_CONFIG.API_HOSTNAME;
    const port       = window.ENV_CONFIG.API_PORT;
    const protocol   = window.ENV_CONFIG.API_PROTOCOL;
    const regionName = window.ENV_CONFIG.REGION_NAME;

    // If hostname is empty or a placeholder → single-container mode
    // nginx proxies /api → backend internally, so use relative URLs
    const isPlaceholder = !hostname
      || hostname === '${REACT_APP_API_HOSTNAME}'
      || hostname === 'placeholder'
      || hostname === '__API_HOSTNAME__';

    if (isPlaceholder) {
      return {
        protocol: '',
        hostname: '',
        port: '',
        regionName: (regionName && regionName !== '${REACT_APP_REGION_NAME}' && regionName !== 'placeholder')
          ? regionName
          : (process.env.REACT_APP_REGION_NAME || 'SAN Region'),
        singleContainer: true,
      };
    }

    return {
      protocol: (protocol && protocol !== '${REACT_APP_API_PROTOCOL}') ? protocol : (process.env.REACT_APP_API_PROTOCOL || 'http'),
      hostname: hostname,
      port:     (port     && port     !== '${REACT_APP_API_PORT}')     ? port     : (process.env.REACT_APP_API_PORT || '5006'),
      regionName: (regionName && regionName !== '${REACT_APP_REGION_NAME}') ? regionName : (process.env.REACT_APP_REGION_NAME || 'SAN Region'),
      singleContainer: false,
    };
  }
  // Fallback to build-time env vars
  return {
    protocol: process.env.REACT_APP_API_PROTOCOL || 'http',
    hostname: process.env.REACT_APP_API_HOSTNAME || '172.30.38.193',
    port: process.env.REACT_APP_API_PORT || '5006',
    regionName: process.env.REACT_APP_REGION_NAME || 'SAN Region',
    singleContainer: false,
  };
};

const config = getRuntimeConfig();

const API_CONFIG = {
  hostname:   config.hostname,
  port:       config.port,
  protocol:   config.protocol,
  regionName: config.regionName,
};

// In single-container mode: use relative URLs so nginx proxies /api → backend
// In two-container mode: use full URL with hostname:port
export const API_BASE_URL = config.singleContainer
  ? ''
  : `${config.protocol}://${config.hostname}:${config.port}`;

// API Endpoints
export const API_ENDPOINTS = {
  overview: (range, startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/overview?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/overview?range=${range}`,
  responseTimeChart: (range, startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/response-time-chart?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/response-time-chart?range=${range}`,
  topApis: (range, startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/top-apis?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/top-apis?range=${range}`,
  failures: (range, startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/failures?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/failures?range=${range}`,
  requestRate: (range, startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/request-rate?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/request-rate?range=${range}`,
  responsePercentiles: (startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/response-percentiles?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/response-percentiles`,
  exceptions: (startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/exceptions?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/exceptions`,
  dependencies: (startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/dependencies?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/dependencies`,
  responseCompare: (startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/responseCompare?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/responseCompare`,
  mysqlConnections: `${API_BASE_URL}/mysqlConnections`,
  nodeCpu: `${API_BASE_URL}/api/node-cpu`,
  mysqlConn: `${API_BASE_URL}/api/mysql-conn`,
  mysqlMetrics: (timespan) => `${API_BASE_URL}/api/mysql-metrics?timespan=${timespan}`,
  nodePool: (timespan) => `${API_BASE_URL}/api/nodepool?timespan=${timespan}`,
  // ── Outage Detection ──────────────────────────────────────────────────────
  spikeDetector:      `${API_BASE_URL}/api/spike-detector`,
  errorBurstTimeline: (range) => `${API_BASE_URL}/api/error-burst-timeline?range=${range}`,
  percentileHeatmap:  (range, startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/percentile-heatmap?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/percentile-heatmap?range=${range}`,
  topFailingUrls:     (range, startDate, endDate) => startDate && endDate
    ? `${API_BASE_URL}/api/top-failing-urls?startDate=${startDate}&endDate=${endDate}`
    : `${API_BASE_URL}/api/top-failing-urls?range=${range}`,
  operationAnomaly:   `${API_BASE_URL}/api/operation-anomaly`,
  // ── AI/ML Alert Engine ────────────────────────────────────────────────────
  alertVapidKey:    `${API_BASE_URL}/api/alerts/vapid-key`,
  alertSubscribe:   `${API_BASE_URL}/api/alerts/subscribe`,
  alertUnsubscribe: `${API_BASE_URL}/api/alerts/unsubscribe`,
  alertRun:         `${API_BASE_URL}/api/alerts/run`,
  alertStatus:      `${API_BASE_URL}/api/alerts/status`,
  alertLog:         `${API_BASE_URL}/api/alerts/log`,
  alertConfig:      `${API_BASE_URL}/api/alerts/config`,
  alertTest:        `${API_BASE_URL}/api/alerts/test`,
  alertAiAnalyze:   `${API_BASE_URL}/api/alerts/ai-analyze`,
  alertAiSummary:   `${API_BASE_URL}/api/alerts/ai-incident-summary`,
  alertAiStatus:    `${API_BASE_URL}/api/alerts/ai-status`,
  // ── Telegram ──────────────────────────────────────────────────────────────
  telegramConfig:  `${API_BASE_URL}/api/telegram/config`,
  telegramTest:    `${API_BASE_URL}/api/telegram/test`,
  telegramSend:    `${API_BASE_URL}/api/telegram/send`,
  telegramStatus:  `${API_BASE_URL}/api/telegram/status`,
  // ── ML Scheduler ──────────────────────────────────────────────────────────
  mlSchedulerStatus: `${API_BASE_URL}/api/ml-scheduler/status`,
  mlSchedulerStart:  `${API_BASE_URL}/api/ml-scheduler/start`,
  mlSchedulerStop:   `${API_BASE_URL}/api/ml-scheduler/stop`,
  whatsappStatus:   `${API_BASE_URL}/api/alerts/whatsapp-status`,
  whatsappConfig:   `${API_BASE_URL}/api/alerts/whatsapp-config`,
  whatsappTest:     `${API_BASE_URL}/api/alerts/whatsapp-test`,
  whatsappSend:     `${API_BASE_URL}/api/alerts/whatsapp-send-alert`,
  // ── ML API Alerts (80-day historical analysis) ────────────────────────────
  mlApiAlerts:        `${API_BASE_URL}/api/ml-api-alerts`,
  mlApiAlertsSummary: `${API_BASE_URL}/api/ml-api-alerts/summary`,
  mlApiHistory:       (api) => `${API_BASE_URL}/api/ml-api-alerts/history?api=${encodeURIComponent(api)}`,
  mlCriticalChart:    (api) => `${API_BASE_URL}/api/ml-api-alerts/critical-chart?api=${encodeURIComponent(api)}`,
  mlRiskForecast:     `${API_BASE_URL}/api/ml-api-alerts/risk-forecast`,
  // ── Failures Panel (Azure-style) ──────────────────────────────────────────
  failuresPanelTimeline:   `${API_BASE_URL}/api/failures-panel/timeline`,
  failuresPanelOperations: `${API_BASE_URL}/api/failures-panel/operations`,
  failuresPanelDetail:     (operation, windowStart, windowEnd) => {
    const base = `${API_BASE_URL}/api/failures-panel/detail?operation=${encodeURIComponent(operation)}`;
    return windowStart && windowEnd
      ? `${base}&windowStart=${encodeURIComponent(windowStart)}&windowEnd=${encodeURIComponent(windowEnd)}`
      : base;
  },
  failuresPanelOverall: `${API_BASE_URL}/api/failures-panel/overall`,
  // ── Performance Panel (Azure-style) ───────────────────────────────────────
  performancePanelTimeline:   `${API_BASE_URL}/api/performance-panel/timeline`,
  performancePanelOperations: `${API_BASE_URL}/api/performance-panel/operations`,
  performancePanelDetail:     (operation, windowStart, windowEnd) => {
    const base = `${API_BASE_URL}/api/performance-panel/detail?operation=${encodeURIComponent(operation)}`;
    return windowStart && windowEnd
      ? `${base}&windowStart=${encodeURIComponent(windowStart)}&windowEnd=${encodeURIComponent(windowEnd)}`
      : base;
  },
  performancePanelOverall: `${API_BASE_URL}/api/performance-panel/overall`,
  // ── API Search (watchlist autocomplete) ──────────────────────────────────
  apiSearch: (q, range, startDate, endDate) => {
    const base = `${API_BASE_URL}/api/api-search?q=${encodeURIComponent(q)}`;
    return startDate && endDate
      ? `${base}&startDate=${startDate}&endDate=${endDate}`
      : `${base}&range=${range || '24h'}`;
  },
  // ── High Failure APIs ─────────────────────────────────────────────────────
  highFailureApis: (range, startDate, endDate, compareStart, compareEnd) => {
    const base = startDate && endDate
      ? `${API_BASE_URL}/api/high-failure-apis?startDate=${startDate}&endDate=${endDate}`
      : `${API_BASE_URL}/api/high-failure-apis?range=${range}`;
    return compareStart && compareEnd
      ? `${base}&compareStart=${encodeURIComponent(compareStart)}&compareEnd=${encodeURIComponent(compareEnd)}`
      : base;
  },
  topApisInWindow: (windowStart, windowEnd) =>
    `${API_BASE_URL}/api/top-apis-in-window?windowStart=${encodeURIComponent(windowStart)}&windowEnd=${encodeURIComponent(windowEnd)}`,
  highFailureApisDetail: (api, range, startDate, endDate, compareStart, compareEnd) => {
    const base = startDate && endDate
      ? `${API_BASE_URL}/api/high-failure-apis/detail?api=${encodeURIComponent(api)}&startDate=${startDate}&endDate=${endDate}`
      : `${API_BASE_URL}/api/high-failure-apis/detail?api=${encodeURIComponent(api)}&range=${range}`;
    return compareStart && compareEnd
      ? `${base}&compareStart=${encodeURIComponent(compareStart)}&compareEnd=${encodeURIComponent(compareEnd)}`
      : base;
  },
};

// Export individual config for direct access if needed
export { API_CONFIG };

export default API_CONFIG;
