import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";
import { useTheme } from "../context/ThemeContext";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";

  // Read runtime config
  const projectName = window.ENV_CONFIG?.PROJECT_NAME || "CCMP";
  const projectLogo = window.ENV_CONFIG?.PROJECT_LOGO || "https://upload.wikimedia.org/wikipedia/commons/2/28/Cricket_Wireless_%282014%29.svg";

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username: form.username,
        password: form.password,
      });
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_expires", String(data.expiresAt));
      localStorage.setItem("auth_user", data.username);
      localStorage.setItem("auth", "true");
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: isLight
        ? "linear-gradient(135deg, #dde0f0 0%, #e8eaf2 50%, #d8dcea 100%)"
        : "linear-gradient(135deg, #0a0f1e 0%, #0d1b2e 50%, #0a1628 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
      padding: "20px",
      transition: "background 0.3s",
    }}>
      {/* Background grid pattern */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: isLight
          ? "linear-gradient(rgba(26,79,170,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26,79,170,0.04) 1px, transparent 1px)"
          : "linear-gradient(rgba(87,148,242,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(87,148,242,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
        {/* Card */}
        <div style={{
          background: isLight ? "rgba(240,242,250,0.97)" : "rgba(17,18,23,0.95)",
          border: isLight ? "1px solid rgba(26,79,170,0.2)" : "1px solid rgba(87,148,242,0.2)",
          borderRadius: 16,
          padding: "40px 36px",
          boxShadow: isLight
            ? "0 24px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(26,79,170,0.05)"
            : "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(87,148,242,0.05)",
          backdropFilter: "blur(20px)",
          transition: "background 0.3s, border-color 0.3s",
        }}>
          {/* Logo + title */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: isLight
                ? "linear-gradient(135deg, rgba(26,79,170,0.15), rgba(26,79,170,0.05))"
                : "linear-gradient(135deg, rgba(87,148,242,0.2), rgba(87,148,242,0.05))",
              border: isLight ? "1px solid rgba(26,79,170,0.25)" : "1px solid rgba(87,148,242,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: isLight ? "0 0 32px rgba(26,79,170,0.1)" : "0 0 32px rgba(87,148,242,0.15)",
            }}>
              <img src={projectLogo} alt="Logo" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>
              {projectName}
            </h1>
            <p style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
              Application Performance Dashboard
            </p>
          </div>

          {/* Status bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", marginBottom: 24,
            background: "rgba(115,191,105,0.06)",
            border: "1px solid rgba(115,191,105,0.15)",
            borderRadius: 8, fontSize: 11, color: T.green,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}`, flexShrink: 0 }} />
            All systems operational · Secure access required
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Username
              </label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                required
                placeholder="Enter username"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: T.inputBg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8, color: T.text,
                  fontSize: 14, padding: "11px 14px",
                  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blue}22`; }}
                onBlur={e => { e.target.style.borderColor = T.border2; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
                placeholder="Enter password"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: T.inputBg,
                  border: `1px solid ${T.border2}`,
                  borderRadius: 8, color: T.text,
                  fontSize: 14, padding: "11px 14px",
                  outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blue}22`; }}
                onBlur={e => { e.target.style.borderColor = T.border2; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 12px", marginBottom: 16,
                background: "rgba(242,73,92,0.08)",
                border: "1px solid rgba(242,73,92,0.25)",
                borderRadius: 8, fontSize: 12, color: T.red,
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px",
                background: loading
                  ? (isLight ? "#c0cce8" : "#1e3a5f")
                  : "linear-gradient(135deg, #1f60c4, #2563eb)",
                border: "none", borderRadius: 8,
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
                boxShadow: loading ? "none" : "0 4px 16px rgba(37,99,235,0.35)",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  Authenticating...
                </>
              ) : "Sign In →"}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: T.dim }}>
            🔒 Secured with JWT · Session expires in 6 hours
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Login;
