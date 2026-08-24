const express = require("express");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { findByEmail, createUser, findById } = require("../data/store");
const { signToken, requireAuth, COOKIE_NAME } = require("../middleware/auth");

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/signup
router.post("/signup", (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Please enter your name." });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  if (findByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id: nanoid(12),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  createUser(user);

  const token = signToken({ id: user.id, name: user.name, email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = signToken({ id: user.id, name: user.name, email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  const user = findById(req.user.id);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

module.exports = router;
