# VITALIS — Frontend + Backend Edition

A full-stack version of the VITALIS Hyderabad emergency-triage app: a Node/Express
backend with real user accounts (sign up / sign in), and a frontend that requires
login before it will use your device location to find the nearest suitable hospital.

## What changed vs. the single-file version

- **Backend (Express, `server.js`)** — hosts the API and the frontend.
- **Accounts** — `POST /api/auth/signup`, `/login`, `/logout`, `GET /api/auth/me`.
  Passwords are hashed with bcrypt; sessions are httpOnly JWT cookies.
- **Data moved server-side** — `data/hospitals.json` and `data/symptoms.json`
  (extracted from your original file) are no longer shipped to the browser as a
  giant inline `<script>`; the client asks the server for matches instead.
- **Triage API** (`routes/triage.js`, login required):
  - `GET /api/triage/suggestions` — symptom list for the search box
  - `POST /api/triage/search` — `{ query, lat, lng }` → matched symptom + the 5
    nearest suitable hospitals (haversine distance computed server-side)
- **Frontend** — split into `public/login.html` (sign in / create account) and
  `public/app.html` (the triage tool, same look as your original design). The
  app page checks `/api/auth/me` on load and bounces to `/login.html` if you're
  not signed in, then asks the browser for geolocation as before.

## Project structure

```
vitalis-app/
  server.js
  data/
    hospitals.json     ← 14 hospitals, extracted from your file
    symptoms.json       ← 50 symptoms, extracted from your file
    store.js            ← tiny JSON-file user store (swap for a real DB later)
    users.json           ← created automatically on first signup
  middleware/auth.js      ← JWT cookie auth
  routes/auth.js           ← signup / login / logout / me
  routes/triage.js          ← symptom match + nearest hospitals
  public/
    login.html
    app.html
    css/style.css
    js/auth.js
    js/app.js
```

## Run it locally

```bash
cd vitalis-app
npm install
cp .env.example .env      # then edit JWT_SECRET to something random
npm start                  # -> http://localhost:3000
```

Open `http://localhost:3000` — it redirects to the sign-in page. Create an
account, sign in, allow location access when the browser prompts, and search
a symptom (or tap one of the quick chips).

## Notes on the user store

`data/store.js` persists users to `data/users.json` on disk — enough to run
and demo the full sign-up/sign-in flow without installing a database. For a
real deployment, swap the functions in that one file for calls to Postgres,
MongoDB, etc. — nothing else in the app needs to change.

## Deploying to Render

This repo includes a `render.yaml` so Render can auto-configure the service
(Blueprint deploy), or you can set it up by hand — either way:

**Option A — Blueprint (fastest)**
1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint**, point it at the repo. Render reads
   `render.yaml` and creates a Web Service with the right build/start
   commands and a random `JWT_SECRET` already generated.
3. Click **Apply** → wait for the first deploy → open the assigned
   `https://<your-service>.onrender.com` URL.

**Option B — Manual web service**
1. In Render: **New → Web Service**, connect the repo.
2. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
3. Add environment variables:
   - `JWT_SECRET` → any long random string
   - `NODE_ENV` → `production`
   (Render sets `PORT` for you automatically — `server.js` already reads
   `process.env.PORT`, so no change needed there.)
4. Deploy. Render gives you a live HTTPS URL — visiting it redirects to
   `/login.html`, exactly like running it locally.

**A note on the free plan:** Render's free instances spin down after periods
of inactivity and spin back up on the next request (with a ~30–60s cold
start) — expected and fine for a demo. `data/users.json` persists on disk
while the instance is alive, but a fresh deploy (new build) resets the
filesystem, which wipes any signed-up accounts. For a class project/demo
that's usually acceptable; if you want accounts to survive redeploys, swap
`data/store.js` for a real database — Render's free **PostgreSQL** add-on is
a natural next step and requires no other code changes outside that file.

## Deploying elsewhere

Any Node host works the same way (Railway, Fly.io, a VPS, etc.):
1. Set the `JWT_SECRET` environment variable to a long random string.
2. Set `NODE_ENV=production` (this makes the session cookie `secure`, so it
   only works over HTTPS — make sure your host terminates TLS).
3. `npm install && npm start`.

If you deploy somewhere with an ephemeral/read-only filesystem (most
serverless platforms), `data/users.json` won't persist between invocations —
that's the point at which to move `data/store.js` to a real database.

## Security notes

- Passwords are hashed with bcrypt (never stored in plain text).
- Sessions use httpOnly, sameSite cookies — not readable by page JavaScript.
- All triage endpoints require a valid session.
- This is still a **prototype for demonstration** — it doesn't replace 108 or
  professional medical care, exactly as the footer says.
