require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const triageRoutes = require("./routes/triage");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/triage", triageRoutes);

// Static frontend (login page is public; app.html checks auth client-side
// via /api/auth/me and redirects to /login.html if not signed in)
app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(path.join(__dirname, "data")));

app.get("/", (req, res) => {
  res.redirect("/app.html");
});

app.listen(PORT, () => {
  console.log(`VITALIS server running at http://localhost:${PORT}`);
});
