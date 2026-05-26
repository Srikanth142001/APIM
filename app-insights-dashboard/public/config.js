// Runtime configuration - will be replaced by docker-entrypoint.sh
window.ENV_CONFIG = {
  API_PROTOCOL: '${REACT_APP_API_PROTOCOL}',
  API_HOSTNAME: '${REACT_APP_API_HOSTNAME}',
  API_PORT: '${REACT_APP_API_PORT}',
  REGION_NAME: '${REACT_APP_REGION_NAME}',
  PROJECT_NAME: 'CCMP',
  PROJECT_LOGO: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg',
  TOP_APIS_LIMIT: '${TOP_APIS_LIMIT}'
};
