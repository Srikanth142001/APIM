/**
 * FeaturesContext — fetches /api/features from the backend and exposes
 * which optional features are enabled based on server env vars.
 *
 * Features:
 *   mysql          — MYSQL_SERVER_NAME is set
 *   infrastructure — AKS_CLUSTER_NAME is set
 *   logAnalytics   — LOG_ANALYTICS_AUTH_TOKEN is set
 *   telegram       — TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set
 */
import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

const FeaturesContext = createContext({
  mysql: true,
  infrastructure: true,
  logAnalytics: true,
  telegram: false,
  loaded: false,
});

export function FeaturesProvider({ children }) {
  const [features, setFeatures] = useState({
    mysql: true,
    infrastructure: true,
    logAnalytics: true,
    telegram: false,
    loaded: false,
  });

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/features`)
      .then(({ data }) => {
        setFeatures({
          mysql:          data.mysql          ?? true,
          infrastructure: data.infrastructure ?? true,
          logAnalytics:   data.logAnalytics   ?? true,
          telegram:       data.telegram       ?? false,
          loaded: true,
        });
      })
      .catch(() => {
        // If the endpoint fails (old backend), default to showing everything
        setFeatures({ mysql: true, infrastructure: true, logAnalytics: true, telegram: false, loaded: true });
      });
  }, []);

  return (
    <FeaturesContext.Provider value={features}>
      {children}
    </FeaturesContext.Provider>
  );
}

export const useFeatures = () => useContext(FeaturesContext);
