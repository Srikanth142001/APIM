/**
 * Axios global interceptors
 * - Attaches JWT Bearer token to every outgoing request
 * - On 401 (expired/invalid), clears auth and redirects to login
 */
import axios from "axios";

// ── Request interceptor: inject token ────────────────────────────────────────
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 ─────────────────────────────────────────
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_expires");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

/**
 * Check if the stored token is still valid (client-side expiry check).
 */
export function isTokenValid() {
  const token = localStorage.getItem("auth_token");
  const expires = localStorage.getItem("auth_expires");
  if (!token || !expires) return false;
  return Date.now() < Number(expires);
}

/**
 * Get remaining session time in seconds.
 */
export function getSessionRemainingSeconds() {
  const expires = localStorage.getItem("auth_expires");
  if (!expires) return 0;
  return Math.max(0, Math.floor((Number(expires) - Date.now()) / 1000));
}

export default axios;
