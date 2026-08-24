const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const COOKIE_NAME = "vitalis_token";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Not signed in." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, name, email }
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

module.exports = { signToken, requireAuth, COOKIE_NAME, JWT_SECRET };
