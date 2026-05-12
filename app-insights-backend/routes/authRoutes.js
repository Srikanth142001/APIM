/**
 * Auth Routes — /api/auth/login
 * Returns a signed JWT valid for 6 hours.
 * Credentials: admin / admin@123
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// Credentials loaded from environment — set ADMIN_USERNAME and ADMIN_PASSWORD in .env
const USERS = [
  {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
  },
];

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = USERS.find(u => u.username === username && u.password && u.password === password);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "6h" }
  );

  const expiresAt = Date.now() + 6 * 60 * 60 * 1000; // ms timestamp

  return res.json({ token, expiresAt, username: user.username, role: user.role });
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
