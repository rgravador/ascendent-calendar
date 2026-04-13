# Personal Dashboard

A single-page Nuxt 3 dashboard that shows today's Google Calendar events with pre-event alarms, a todo list, and a notes area. Single user, MongoDB Atlas storage, AWS Amplify hosting. Editorial/magazine aesthetic.

## Stack

- Nuxt 3 (SSR) + TypeScript
- Tailwind CSS + Fraunces (display) + Inter Tight (body)
- MongoDB Atlas via the official `mongodb` Node driver
- Google Calendar API v3 (read-only)
- AWS Amplify Hosting

## Quick start (mock mode — no external services)

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000. You'll land straight on the dashboard with:
- A fake schedule of today's events (including one 3 min away so the alarm fires)
- Seeded todos and notes
- No login prompt, no Mongo, no Google OAuth

Mock data lives in process memory and resets when you restart the dev server.

To turn mock mode off, set `NUXT_MOCK_MODE=0` and `NUXT_PUBLIC_MOCK_MODE=0` (or remove those lines) and configure the real env vars below.

## Local development with real services

```bash
cp .env.example .env
# set NUXT_MOCK_MODE=0 and NUXT_PUBLIC_MOCK_MODE=0
# fill in MONGO_URI, Google OAuth creds, DASHBOARD_PASSWORD, SETUP_SECRET, SESSION_SECRET

npm install
npm run dev
```

Open http://localhost:3000 and log in with `DASHBOARD_PASSWORD`.

## First-run Google Calendar setup

1. Create an OAuth Web client in Google Cloud Console.
2. Add `http://localhost:3000/setup/callback` (and later your Amplify origin) as an Authorized redirect URI.
3. Enable the Google Calendar API for the project.
4. Start the app and visit `/setup?secret=<SETUP_SECRET>`.
5. Click "Connect Google Calendar" and approve the scopes.

The refresh token is stored in MongoDB. If you ever revoke access or the token stops working, just re-run `/setup`.

## Environment variables

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `GOOGLE_CLIENT_ID` | OAuth Web client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth Web client secret |
| `GOOGLE_REDIRECT_URI` | Exact URI registered in GCP (e.g. `https://<amplify>/setup/callback`) |
| `SETUP_SECRET` | Required as `?secret=...` to access `/setup` |
| `DASHBOARD_PASSWORD` | Password for `/login` |
| `SESSION_SECRET` | HMAC key for signing session cookies (>= 32 chars) |

## Deployment (AWS Amplify Hosting)

1. **MongoDB Atlas**
   - Create a dedicated database user with read/write on the `dashboard` DB only.
   - Allow network access from `0.0.0.0/0` (Amplify/Lambda IPs are not static — protect with a strong unique password and TLS).
   - Copy the connection string into `MONGO_URI`.

2. **Google Cloud OAuth**
   - Create a Web OAuth Client.
   - Add `https://<your-amplify-domain>/setup/callback` as an Authorized redirect URI.
   - Enable the Google Calendar API on the project.

3. **Amplify app**
   - Connect this repository to Amplify Hosting.
   - Amplify should auto-detect `amplify.yml`.
   - In the app's build settings, set `NITRO_PRESET=aws-amplify` (confirm the current preset name against the Nuxt + Amplify docs at deploy time).
   - Add all environment variables from `.env.example` under **App settings → Environment variables**.
   - Trigger a deploy.

4. **Smoke test**
   - `GET /api/health` returns 200.
   - `/login` accepts `DASHBOARD_PASSWORD`.
   - `/setup?secret=<SETUP_SECRET>` runs OAuth and persists a refresh token.
   - `/` shows today's events; create a todo and a note and hard-refresh to confirm persistence.
   - Create a Google Calendar event ~6 minutes out with offset 5 → notification + chime fires.

### Re-seeding Google tokens

If Google revokes the refresh token (password change, long inactivity, scope change), revisit `/setup?secret=...` and click **Re-connect Google Calendar**. The app only needs `calendar.readonly`.

### Why no AWS Cognito?

This is a single-user app. A password cookie (HMAC-signed, HttpOnly, Secure, SameSite=Lax) is sufficient and avoids operating a user pool. If you ever need multi-user, swap `server/middleware/auth.ts` for Cognito-based auth and migrate `settings` to be user-scoped.

## Plan & brainstorm

- Requirements: `docs/brainstorms/2026-04-13-personal-dashboard-requirements.md`
- Plan: `docs/plans/2026-04-13-001-feat-personal-dashboard-plan.md`
