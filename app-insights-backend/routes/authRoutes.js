/**
 * Auth Routes — /api/auth/login
 *
 * Supports multiple users via environment variables:
 *
 *   Admin (full access):
 *     ADMIN_USERNAME=admin          (default: admin)
 *     ADMIN_PASSWORD=secret
 *
 *   Viewer accounts (read-only, no edit/delete/create):
 *     VIEWER_USERNAME=viewer        (default: viewer)
 *     VIEWER_PASSWORD=viewpass
 *
 *   Extra users (comma-separated, format: username:password:role):
 *     EXTRA_USERS=alice:pass1:viewer,bob:pass2:admin,carol:pass3:viewer
 *
 * Roles:
 *   admin  — full access (create/edit/delete panels, dashboards, connections)
 *   viewer — read-only (view dashboards and panels, no modifications)
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

/* ── Build user list from env vars ─────────────────────────────────────────── */
function buildUsers() {
  const users = [];

  // Admin user
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass) {
    users.push({ username: adminUser.toLowerCase(), password: adminPass, role: "admin" });
  }

  // Viewer user
  const viewerUser = process.env.VIEWER_USERNAME || "viewer";
  const viewerPass = process.env.VIEWER_PASSWORD;
  if (viewerPass) {
    users.push({ username: viewerUser.toLowerCase(), password: viewerPass, role: "viewer" });
  }

  // Extra users: EXTRA_USERS=alice:pass1:viewer,bob:pass2:admin
  const extraUsers = process.env.EXTRA_USERS || "";
  if (extraUsers.trim()) {
    extraUsers.split(",").forEach(entry => {
      const parts = entry.trim().split(":");
      if (parts.length >= 2) {
        const [username, password, role = "viewer"] = parts;
        if (username && password) {
          users.push({
            username: username.toLowerCase(),
            password,
            role: role === "admin" ? "admin" : "viewer",
          });
        }
      }
    });
  }

  return users;
}

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const users = buildUsers();

  if (users.length === 0) {
    return res.status(503).json({ error: "No users configured. Set ADMIN_PASSWORD environment variable." });
  }

  const user = users.find(
    u => u.username === username.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "6h" }
  );

  const expiresAt = Date.now() + 6 * 60 * 60 * 1000;

  console.log(`✅ Login: ${user.username} (${user.role})`);

  return res.json({
    token,
    expiresAt,
    username: user.username,
    role: user.role,
  });
});

// GET /api/auth/verify — lightweight token check
router.get("/verify", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    return res.json({ valid: true, username: payload.username, role: payload.role });
  } catch {
    return res.status(401).json({ valid: false, expired: true });
  }
});

module.exports = router;
