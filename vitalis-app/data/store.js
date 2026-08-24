// Minimal file-backed JSON "database" for users.
// Good enough for a demo/single-instance deployment. For production scale,
// swap this out for a real database (Postgres, MongoDB, etc.) — the rest
// of the app only talks to the functions exported here, so that's a
// contained change.
const fs = require("fs");
const path = require("path");

const USERS_FILE = path.join(__dirname, "users.json");

function ensureFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf8");
  }
}

function readUsers() {
  ensureFile();
  const raw = fs.readFileSync(USERS_FILE, "utf8");
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function findByEmail(email) {
  const users = readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function findById(id) {
  const users = readUsers();
  return users.find((u) => u.id === id);
}

function createUser(user) {
  const users = readUsers();
  users.push(user);
  writeUsers(users);
  return user;
}

module.exports = { readUsers, writeUsers, findByEmail, findById, createUser };
