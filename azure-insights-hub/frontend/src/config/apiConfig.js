const getRuntimeConfig = () => {
  if (typeof window !== 'undefined' && window.ENV_CONFIG) {
    const hostname = window.ENV_CONFIG.API_HOSTNAME;
    const port     = window.ENV_CONFIG.API_PORT;
    const protocol = window.ENV_CONFIG.API_PROTOCOL;

    // If hostname is empty/placeholder → use same-origin (single container mode)
    const isPlaceholder = !hostname || hostname === '${REACT_APP_API_HOSTNAME}' || hostname === '__API_HOSTNAME__';
    if (isPlaceholder) {
      return { baseUrl: '' }; // relative URLs — nginx proxies /api to backend
    }

    const resolvedProtocol = (!protocol || protocol === '${REACT_APP_API_PROTOCOL}') ? 'http' : protocol;
    const resolvedPort     = (!port     || port     === '${REACT_APP_API_PORT}')     ? '5001' : port;
    return { baseUrl: `${resolvedProtocol}://${hostname}:${resolvedPort}` };
  }
  // Dev fallback
  return {
    baseUrl: `${process.env.REACT_APP_API_PROTOCOL || 'http'}://${process.env.REACT_APP_API_HOSTNAME || 'localhost'}:${process.env.REACT_APP_API_PORT || '5001'}`
  };
};

const { baseUrl } = getRuntimeConfig();
export const API_BASE_URL = baseUrl;

export const API_ENDPOINTS = {
  // Auth
  login: `${API_BASE_URL}/api/auth/login`,
  verify: `${API_BASE_URL}/api/auth/verify`,

  // Environment config
  environments: `${API_BASE_URL}/api/environments`,
  testConnection: `${API_BASE_URL}/api/environments/test`,
  discoverResources: `${API_BASE_URL}/api/environments/discover`,

  // Overview
  overview: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/overview?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/overview?range=${range}`,

  // API Analytics
  topApis: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/top-apis?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/top-apis?range=${range}`,

  failures: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/failures?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/failures?range=${range}`,

  requestRate: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/request-rate?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/request-rate?range=${range}`,

  responseCompare: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/response-compare?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/response-compare?range=${range}`,

  // Performance
  perfTimeline: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/performance/timeline?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/performance/timeline?range=${range}`,

  perfOperations: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/performance/operations?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/performance/operations?range=${range}`,

  perfDetail: (envId, op, range) =>
    `${API_BASE_URL}/api/${envId}/performance/detail?operation=${encodeURIComponent(op)}&range=${range || '24h'}`,

  // Failures panel
  failuresTimeline: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/failures-panel/timeline?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/failures-panel/timeline?range=${range}`,

  failuresOperations: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/failures-panel/operations?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/failures-panel/operations?range=${range}`,

  // API Search (watchlist)
  apiSearch: (envId, q, range) =>
    `${API_BASE_URL}/api/${envId}/api-search?q=${encodeURIComponent(q)}&range=${range || '24h'}`,

  // Outage Detection / High Failure
  spikeDetector: (envId) =>
    `${API_BASE_URL}/api/${envId}/spike-detector`,

  errorBurstTimeline: (envId, range) =>
    `${API_BASE_URL}/api/${envId}/error-burst-timeline?range=${range}`,

  responsePercentiles: (envId, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/response-percentiles?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/response-percentiles`,

  topFailingUrls: (envId, range, start, end) =>
    start && end
      ? `${API_BASE_URL}/api/${envId}/top-failing-urls?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/top-failing-urls?range=${range}`,

  highFailureApis: (envId, range, start, end, compareStart, compareEnd) => {
    let url = start && end
      ? `${API_BASE_URL}/api/${envId}/high-failure-apis?startDate=${start}&endDate=${end}`
      : `${API_BASE_URL}/api/${envId}/high-failure-apis?range=${range}`;
    if (compareStart && compareEnd) url += `&compareStart=${compareStart}&compareEnd=${compareEnd}`;
    return url;
  },

  highFailureApisDetail: (envId, api, range, start, end, compareStart, compareEnd) => {
    let url = `${API_BASE_URL}/api/${envId}/high-failure-apis/detail?api=${encodeURIComponent(api)}&range=${range || '24h'}`;
    if (start && end) url += `&startDate=${start}&endDate=${end}`;
    if (compareStart && compareEnd) url += `&compareStart=${compareStart}&compareEnd=${compareEnd}`;
    return url;
  },

  failureCodes: (envId, range) =>
    `${API_BASE_URL}/api/${envId}/failure-codes?range=${range}`,

  topApisInWindow: (envId, ts1, ts2) =>
    `${API_BASE_URL}/api/${envId}/failures-panel/operations?windowStart=${encodeURIComponent(ts1)}&windowEnd=${encodeURIComponent(ts2)}`,
};

export default API_BASE_URL;
