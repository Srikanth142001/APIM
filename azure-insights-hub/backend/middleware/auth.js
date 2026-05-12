/**
 * JWT Authentication Middleware
 * Validates Bearer token on every protected API request.
 * Token expires in 6 hours.
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  process.exit(1);
}

/**
 * Express middleware — attach to any route that needs protection.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized — no token provided" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired — please log in again", expired: true });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { requireAuth, JWT_SECRET };
