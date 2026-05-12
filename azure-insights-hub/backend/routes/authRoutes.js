/**
 * Auth Routes — /api/auth/login & /api/auth/verify
 * Returns a signed JWT valid for 6 hours.
 * Credentials loaded from ADMIN_USERNAME / ADMIN_PASSWORD env vars.
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const validUsername = process.env.ADMIN_USERNAME || "admin";
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validPassword) {
    return res.status(500).json({ error: "Server misconfiguration: ADMIN_PASSWORD not set" });
  }

  if (username !== validUsername || password !== validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { username, role: "admin" },
    JWT_SECRET,
    { expiresIn: "6h" }
  );

  const expiresAt = Date.now() + 6 * 60 * 60 * 1000;

  return res.json({ token, expiresAt, username, role: "admin" });
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
