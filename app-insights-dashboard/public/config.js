// Runtime configuration - will be replaced by docker-entrypoint.sh
window.ENV_CONFIG = {
  API_PROTOCOL: '${REACT_APP_API_PROTOCOL}',
  API_HOSTNAME: '${REACT_APP_API_HOSTNAME}',
  API_PORT: '${REACT_APP_API_PORT}',
  REGION_NAME: '${REACT_APP_REGION_NAME}'
};
