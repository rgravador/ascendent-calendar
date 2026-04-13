---
title: Personal Dashboard — Calendar, Alarms, Todos, Notes
type: feat
status: completed
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-personal-dashboard-requirements.md
---

# Personal Dashboard — Calendar, Alarms, Todos, Notes

## Overview

Build a single-page Nuxt 3 dashboard hosted on AWS Amplify that displays today's Google Calendar events, fires browser notifications + sound at a configurable offset before each event, and provides a todo list (priority + due date) and multiple short note cards. Single user, MongoDB Atlas persistence, editorial/magazine aesthetic.

## Problem Frame

Opening Google Calendar, a notes app, and a task app separately is friction. The dashboard consolidates them into one focused browser tab with reliable pre-event alarms and a typographic feel that is not another generic admin template. (see origin: `docs/brainstorms/2026-04-13-personal-dashboard-requirements.md`)

## Requirements Trace

- **R1.** Read and display today's events from the primary Google Calendar (read-only, chronological, live time-until indicator).
- **R2.** Fire a desktop notification + audible chime a configurable fixed offset before every event, at most once per event per day, while the tab is open.
- **R3.** Todos with text + priority (High/Med/Low) + optional due date; sort incomplete first, then priority, then due date; flag overdue.
- **R4.** Multiple short note cards (add/edit inline/delete), sorted by most-recently-edited.
- **R5.** Single-page layout: schedule on top, todos bottom-left, notes bottom-right.
- **R6.** Editorial/magazine aesthetic: serif display font, asymmetric grid, single accent color.
- **R7.** Deploy on AWS Amplify; data in MongoDB Atlas; single user.

## Scope Boundaries

- **Non-goals:** multi-user, creating/editing Google Calendar events, per-event custom alarms, push-while-tab-closed, mobile-native apps, markdown/tags/search on notes, week/month calendar views, collaborative features.
- Google Calendar is **read-only**. Alarms only fire while the tab is open.
- Mobile layout is nice-to-have, not a requirement.

## Context & Research

### Relevant Code and Patterns

- Empty repository — greenfield. No existing patterns to mirror.

### Institutional Learnings

- None applicable (empty `docs/solutions/`).

### External References

Implementer should consult at execution time:
- Google Calendar API v3 — `events.list` with `timeMin`/`timeMax`/`singleEvents=true`/`orderBy=startTime`.
- Google OAuth 2.0 web server flow — `offline` access + `prompt=consent` to reliably get a refresh token.
- Nuxt 3 Nitro server routes and `runtimeConfig` for secrets.
- AWS Amplify Hosting — Nuxt 3 SSR deployment (Nitro `aws-lambda` or `aws-amplify` preset).
- MongoDB Node driver (official) — preferred over Mongoose for a small app with 3 collections.
- Web Notifications API + `HTMLAudioElement` for chime playback (autoplay policies: audio must be unlocked by a user gesture before it can play silently in background).

## Key Technical Decisions

- **Framework: Nuxt 3 with SSR.** Server routes own Google Calendar calls and Mongo access so secrets never reach the client.
- **Auth model: single-user, no user accounts.** The app is protected at the edge by a `DASHBOARD_PASSWORD` session cookie (simple password form, HMAC-signed cookie). No Cognito / OAuth user pool.
- **Google OAuth seeding: first-run `/setup` page.** Guarded by a `SETUP_SECRET` env var. Runs the OAuth web-server flow, exchanges code for a refresh token, stores it in Mongo `settings`. Re-accessible to re-seed if the token is revoked.
- **Mongo driver: official `mongodb` Node driver.** Three collections: `settings` (singleton), `todos`, `notes`. No ORM — schemas are trivial.
- **Alarm scheduler lives on the client.** Fetched events are kept in memory; a per-event `setTimeout` fires at `event.start - offset`. Fired IDs are tracked in `localStorage` keyed by `YYYY-MM-DD:eventId` to survive refreshes.
- **Audio unlock:** a one-time "Enable sound" affordance the user clicks on first load to prime the `Audio` element (required by browser autoplay rules).
- **Calendar refresh:** server route returns today's events; client refetches every 5 min and on `visibilitychange` → visible. Scheduler is recomputed from the latest event list on each refresh.
- **Styling: Tailwind CSS with custom fonts.** Serif display font (`Fraunces` or `GT Sectra`-like free alternative, e.g. `Fraunces`) from Fontsource; body in a refined sans (e.g. `Inter Tight` or a neutral grotesk — deliberately not stock Inter). One accent color.
- **Deploy: Amplify Hosting with Nitro SSR preset.** Secrets injected via Amplify environment variables; MongoDB Atlas IP allowlist set to `0.0.0.0/0` with strong DB credentials (Amplify/Lambda IPs are not static).

## Open Questions

### Resolved During Planning

- **How is OAuth seeded?** First-run `/setup` page protected by `SETUP_SECRET`.
- **Default alarm offset?** 5 minutes, configurable from a header settings popover.
- **Permission UX when denied?** Persistent inline banner at top of the page with a re-request button and a short explanation.
- **Calendar polling cadence?** 5 minutes + on tab focus.
- **Timezone?** Browser local only.
- **Auth protection?** Single password cookie — no user accounts.

### Deferred to Implementation

- Exact font choice for display vs body (pick at scaffold time after seeing them rendered together).
- Audio chime asset (commission a short tone or use a permissively-licensed sample; final pick is an implementation detail).
- Whether to use Nuxt UI, Nuxt Icon, or handwrite the few UI primitives needed (lean handwritten for aesthetic control).
- Exact Nitro preset for Amplify (`aws-lambda` vs an Amplify-specific preset) — confirm against current Amplify + Nitro docs at deploy time.
- Index strategy on `todos` and `notes` — likely none needed at this scale; revisit if list UX lags.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌──────────────────────────── Browser (Nuxt client) ────────────────────────────┐
│                                                                               │
│  ┌───────────────────┐  ┌────────────────┐  ┌───────────────┐                 │
│  │ Today's Schedule  │  │ Alarm Scheduler│  │ Permission    │                 │
│  │ (live time-until) │◀─│ (setTimeout    │─▶│ Banner +      │                 │
│  └─────────▲─────────┘  │  per event,    │  │ Audio Unlock  │                 │
│            │            │  localStorage  │  └───────────────┘                 │
│            │            │  fired-IDs)    │                                    │
│            │            └────────▲───────┘                                    │
│            │                     │                                            │
│  ┌─────────┴──────────┐  ┌───────┴───────┐                                    │
│  │ Todos              │  │ Notes          │                                   │
│  │ (priority+due date)│  │ (cards)        │                                   │
│  └─────────▲──────────┘  └───────▲────────┘                                   │
│            │                     │                                            │
└────────────┼─────────────────────┼────────────────────────────────────────────┘
             │ fetch (every 5m,    │
             │ on focus, on CRUD)  │
┌────────────▼─────────────────────▼────────────────────────────────────────────┐
│                         Nuxt 3 Nitro server routes                            │
│                                                                               │
│  /api/session   /api/calendar/today   /api/todos   /api/notes   /api/settings │
│  /setup  (OAuth init + callback, guarded by SETUP_SECRET)                     │
│                                                                               │
│  password-cookie auth middleware (except /setup with SETUP_SECRET)            │
└────────────┬────────────────────────────────┬─────────────────────────────────┘
             │                                │
             ▼                                ▼
     ┌──────────────┐              ┌─────────────────────┐
     │ Google       │              │ MongoDB Atlas       │
     │ Calendar API │              │ settings/todos/notes│
     └──────────────┘              └─────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Project scaffold and editorial style system**

**Goal:** Stand up Nuxt 3 with TypeScript strict, Tailwind, fonts, and a static dashboard shell rendering the three-region layout with placeholder content. No data yet.

**Requirements:** R5, R6

**Dependencies:** None

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.example`, `.gitignore`
- Create: `app.vue`, `pages/index.vue`
- Create: `assets/css/main.css`, `assets/fonts/` (Fontsource or self-hosted)
- Create: `components/ScheduleSection.vue`, `components/TodosSection.vue`, `components/NotesSection.vue` (placeholder markup only)
- Create: `README.md` (local dev + env var list)

**Approach:**
- Nuxt 3 with `ssr: true`. TypeScript `strict: true`.
- Tailwind via `@nuxtjs/tailwindcss`. Define a small design-token layer in `main.css`: `--accent`, `--ink`, `--paper`, `--rule` CSS variables.
- Pair one distinctive serif display font with a refined body face; avoid Inter/Roboto/Arial defaults (per global frontend-design rule).
- Single-page layout using CSS Grid: schedule spans the top as the dominant region with asymmetric column proportions; todos + notes sit on the bottom row with a visible hairline divider. Generous whitespace, magazine-style typographic hierarchy (kicker / headline / meta).
- `runtimeConfig` keys declared but empty: `mongoUri`, `googleClientId`, `googleClientSecret`, `googleRedirectUri`, `setupSecret`, `dashboardPassword`, `sessionSecret`.

**Patterns to follow:**
- None (greenfield). Follow global `.claude/rules/frontend-design.md` for aesthetic restraint and distinctive typography.

**Test scenarios:**
- Test expectation: none — scaffold and static layout only; covered indirectly by later units' E2E checks.

**Verification:**
- `npm run dev` renders the single page with three regions, custom fonts load, no console errors.
- Type-check (`npm run type-check` or `nuxi typecheck`) is clean.

---

- [ ] **Unit 2: MongoDB data layer**

**Goal:** Provide a server-side MongoDB connection helper and repository functions for `settings`, `todos`, and `notes`.

**Requirements:** R3, R4, R7

**Dependencies:** Unit 1

**Files:**
- Create: `server/utils/mongo.ts` (singleton connection, re-used across Nitro invocations)
- Create: `server/repositories/settings.ts`, `server/repositories/todos.ts`, `server/repositories/notes.ts`
- Create: `server/types/models.ts` (TypeScript interfaces for `Settings`, `Todo`, `Note`)
- Test: `tests/server/repositories/todos.spec.ts`, `tests/server/repositories/notes.spec.ts`, `tests/server/repositories/settings.spec.ts`

**Approach:**
- Use the official `mongodb` Node driver. Export a `getDb()` that lazily connects and caches the client on `globalThis` to survive Nitro hot-reloads and Lambda warm containers.
- `Settings` is a singleton document keyed by `_id: "singleton"`; fields: `alarmOffsetMinutes`, `googleRefreshToken`, `googleTokenUpdatedAt`.
- `Todo` fields: `_id`, `text`, `priority` (`'high'|'med'|'low'`), `dueDate?` (ISO string), `done` (bool), `createdAt`, `updatedAt`.
- `Note` fields: `_id`, `title?`, `body`, `createdAt`, `updatedAt`.
- Repository functions are thin: `list`, `create`, `update`, `remove`, plus `getSettings` / `updateSettings`.
- Tests use a `mongodb-memory-server` instance; no network calls.

**Patterns to follow:**
- Global `.claude/rules/code-conventions.md` — early returns, immutability, named constants for priority values.

**Test scenarios:**
- Happy path: `todos.create` persists a todo and `list` returns it sorted by `done` asc, then priority, then due date asc.
- Happy path: `notes.update` changes `body` and bumps `updatedAt`; `list` orders by `updatedAt` desc.
- Happy path: `settings.getSettings` returns a default record (`alarmOffsetMinutes: 5`) when none exists.
- Edge case: `todos.list` correctly sorts when some todos lack `dueDate` (nulls sort last).
- Error path: `todos.update` on unknown id returns a not-found signal rather than throwing.
- Edge case: `settings.updateSettings` is idempotent — running it twice yields the same singleton doc.

**Verification:**
- Repository unit tests pass against in-memory Mongo.
- `getDb()` is called twice in a single test and returns the same client instance (connection reuse).

---

- [ ] **Unit 3: Session auth and Google OAuth seeding**

**Goal:** Protect the dashboard behind a simple password cookie, and provide a `/setup` page that runs the Google OAuth web flow and stores the refresh token in `settings`.

**Requirements:** R1, R7

**Dependencies:** Unit 2

**Files:**
- Create: `server/middleware/auth.ts` (checks signed `dashboard_session` cookie on every request except `/login`, `/setup`, `/api/session/login`, `/setup/callback`)
- Create: `server/api/session/login.post.ts`, `server/api/session/logout.post.ts`
- Create: `server/api/session/status.get.ts`
- Create: `pages/login.vue` (single password form)
- Create: `pages/setup.vue` (shows current token status, button to start OAuth; requires `?secret=SETUP_SECRET` query)
- Create: `server/routes/setup/start.get.ts` (redirects to Google consent URL)
- Create: `server/routes/setup/callback.get.ts` (exchanges code → refresh token → stores in settings)
- Create: `server/utils/google-oauth.ts` (wraps the `google-auth-library` OAuth2 client)
- Create: `server/utils/cookies.ts` (HMAC-sign/verify helpers)
- Test: `tests/server/utils/cookies.spec.ts`, `tests/server/middleware/auth.spec.ts`

**Approach:**
- Password check: constant-time compare of submitted value to `DASHBOARD_PASSWORD`; on success issue an HMAC-signed, HttpOnly, Secure, SameSite=Lax cookie valid for 30 days. HMAC key is `SESSION_SECRET`.
- OAuth scopes: `https://www.googleapis.com/auth/calendar.readonly`. Request `access_type=offline`, `prompt=consent` to guarantee a refresh token.
- `/setup` is gated by comparing `?secret=` to `SETUP_SECRET` (constant-time). This lets the owner re-seed after a token revocation without bundling a local CLI script.
- Store only the refresh token (plus `updatedAt`) in `settings`. Access tokens are re-derived on demand per request.
- **Secret handling:** never log secrets. The refresh token value is treated as sensitive; error messages must not echo it.

**Execution note:** Write auth middleware behavior tests first — this is the only security-sensitive surface.

**Patterns to follow:**
- Global `.claude/rules/security.md` — validate user input at the boundary, constant-time secret compare, no secrets in logs.

**Test scenarios:**
- Happy path: valid password POST to `/api/session/login` sets a cookie whose HMAC verifies on subsequent requests.
- Happy path: valid setup secret at `/setup` renders the "Connect Google" button; callback with a valid code stores a refresh token in `settings` and redirects to `/`.
- Error path: wrong password returns 401 and no cookie is issued.
- Error path: missing or mismatched `SETUP_SECRET` on `/setup` returns 403.
- Error path: OAuth callback with an `error` query param renders a friendly error and does not touch `settings`.
- Edge case: tampered cookie (valid format, bad HMAC) is rejected and the request is redirected to `/login`.
- Edge case: re-running `/setup` successfully overwrites the stored refresh token (re-seed flow).
- Integration: authenticated request to any `/api/*` route passes middleware; unauthenticated request is redirected or 401'd.

**Verification:**
- Auth middleware tests pass.
- Manually confirmed (at implementation time) that an end-to-end local OAuth round-trip results in a stored refresh token.

---

- [ ] **Unit 4: Calendar API + Today's Schedule UI**

**Goal:** Fetch today's events from Google Calendar server-side and render them with a live time-until indicator.

**Requirements:** R1, R5

**Dependencies:** Units 2, 3

**Files:**
- Create: `server/api/calendar/today.get.ts`
- Create: `server/services/calendar.ts` (uses stored refresh token → fresh access token → `calendar.events.list`)
- Create: `composables/useSchedule.ts` (client polling every 5 min + on `visibilitychange` → visible)
- Modify: `components/ScheduleSection.vue` (renders events; states: upcoming / current / past)
- Create: `components/EventRow.vue`
- Create: `utils/time.ts` (pure functions: `diffMinutes`, `formatRelative`, `isCurrent`)
- Test: `tests/server/services/calendar.spec.ts`, `tests/utils/time.spec.ts`

**Approach:**
- `calendar.events.list` call: `calendarId=primary`, `timeMin=start-of-today`, `timeMax=end-of-today`, `singleEvents=true`, `orderBy=startTime`, `maxResults=50`.
- Map response to a minimal `EventDTO`: `{ id, title, start, end, location?, htmlLink }`. Discard all-day events or surface them in a dedicated "All-day" sub-list (decision: discard for v1 since dashboard is about time-bound events).
- Server route caches nothing beyond the current request. Access tokens are cached in-memory for their `expires_in` to avoid refreshing on every call.
- UI: magazine-style list with a large time column, title in serif display at moderate size, meta row (duration, location). `EventRow` computes `time-until` via a single page-level `useIntervalFn(60_000)` passed down, not per-row timers.
- Past events render de-emphasized (reduced contrast); a "current" event gets a subtle accent underline.

**Patterns to follow:**
- Global `.claude/rules/code-conventions.md` — extract named constants (`POLL_INTERVAL_MS = 5 * 60 * 1000`, `TICK_INTERVAL_MS = 60_000`).

**Test scenarios:**
- Happy path: `calendar.today` returns today's events sorted ascending by start (service test with mocked Google client).
- Happy path: `time.diffMinutes` returns a negative number for past, positive for future, zero for now.
- Edge case: event list is empty → UI shows an editorial empty state ("No events today.").
- Edge case: access token refresh fails with `invalid_grant` → service surfaces a typed error the route maps to 502 with a message telling the user to re-run `/setup`.
- Edge case: all-day event filtering — an event with only `start.date` (no `dateTime`) is excluded.
- Error path: Google API 5xx → service throws; route returns 502; UI shows a non-blocking retry banner instead of a blank page.
- Integration: on `visibilitychange` to visible after 10 min away, the composable triggers a refetch (verified by counting API calls).

**Verification:**
- Unit tests pass.
- In dev, today's real events render within ~2s of load and refresh silently on interval.

---

- [ ] **Unit 5: Alarm scheduler (browser notifications + sound) and settings**

**Goal:** Fire a desktop notification + chime at `event.start - offset` for every event, at most once per event per day. Provide a settings popover in the header to edit `alarmOffsetMinutes`.

**Requirements:** R2

**Dependencies:** Unit 4

**Files:**
- Create: `composables/useAlarms.ts`
- Create: `components/PermissionBanner.vue` (inline banner when Notification permission is not `granted`)
- Create: `components/AudioUnlock.vue` ("Enable sound" button; plays a silent buffer to prime audio)
- Create: `components/SettingsPopover.vue` (edit alarm offset)
- Create: `server/api/settings.get.ts`, `server/api/settings.patch.ts`
- Create: `public/sounds/chime.mp3` (permissively-licensed short tone; final selection deferred)
- Test: `tests/composables/useAlarms.spec.ts`

**Approach:**
- `useAlarms(events, offsetMinutes)` computes a fire plan: for each event, `fireAt = start - offset`. If `fireAt > now`, schedule a `setTimeout`. If `fireAt <= now` and event hasn't fired and event hasn't started more than a short grace window ago, fire immediately.
- Fired-state key: `fired:${YYYY-MM-DD}:${eventId}` in `localStorage`. Written before firing to prevent duplicates on race with re-schedule.
- On every events refresh or offset change, clear all timers and rebuild the plan from scratch. All timers are tracked so they can be cleared cleanly on unmount.
- Notification payload: `{ title: event.title, body: 'Starts at HH:MM · in N min', icon, tag: event.id }` — `tag` coalesces duplicate notifications.
- Chime plays via a single shared `HTMLAudioElement`. Volume reasonable; respect user mute via audio-unlock flag.
- Permission flow: on first load, show `PermissionBanner` if `Notification.permission !== 'granted'`. Clicking "Enable" requests permission; if denied, banner stays and explains the limitation.
- Settings popover writes via `PATCH /api/settings`, then invalidates the scheduler so timers rebuild against the new offset.

**Execution note:** Write composable tests first using fake timers — the scheduler is the highest-risk piece.

**Patterns to follow:**
- Global `.claude/rules/code-conventions.md` — named constants (`GRACE_WINDOW_MS`), guard clauses for permission/unlock states, no inline setTimeout math.

**Test scenarios:**
- Happy path: given one event starting in 10 min with offset 5, the scheduler registers a timer that fires a Notification mock after ~5 min (fake timers).
- Happy path: firing writes `fired:...` to `localStorage` and does not re-fire if `useAlarms` is rebuilt.
- Happy path: changing `offsetMinutes` rebuilds timers with new fire times and prior timers are cleared.
- Edge case: event whose `start - offset` already passed but within grace window fires immediately once.
- Edge case: event whose start is more than the grace window in the past does not fire.
- Edge case: same event present across two refreshes is only fired once (localStorage gate).
- Edge case: date rolls over at midnight — yesterday's `fired:` keys do not block today's events.
- Error path: Notification permission is `denied` — scheduler still plays chime if sound is unlocked; banner explains the missing desktop notification.
- Integration: events refresh while a timer is pending → timers are cleared and rebuilt with no double-fire (verified by firing count assertion).

**Verification:**
- Scheduler tests pass with fake timers.
- Manual smoke: temporarily create a Google Calendar event 6 minutes out with offset 5 → notification + chime fire ~1 min later.

---

- [ ] **Unit 6: Todos — API + UI**

**Goal:** Full CRUD for todos with priority + optional due date, rendered in the bottom-left region.

**Requirements:** R3, R5

**Dependencies:** Unit 2

**Files:**
- Create: `server/api/todos/index.get.ts`, `server/api/todos/index.post.ts`
- Create: `server/api/todos/[id].patch.ts`, `server/api/todos/[id].delete.ts`
- Create: `composables/useTodos.ts`
- Modify: `components/TodosSection.vue`
- Create: `components/TodoItem.vue`, `components/TodoAddForm.vue`
- Test: `tests/server/api/todos.spec.ts`, `tests/components/TodoItem.spec.ts`

**Approach:**
- Sort in the repository (not the UI) for consistency: `done` asc, then priority (`high` > `med` > `low`), then `dueDate` asc with nulls last.
- Overdue flagging is a UI concern: an incomplete todo with `dueDate < startOfToday` renders with an accent overdue mark.
- Completed items are visually de-emphasized and collapsed into a "Done" section that can be expanded.
- API bodies validated at the boundary: reject unknown priority values, reject empty text after trim, cap text length (e.g., 500 chars) and due date sanity-check.
- Client uses optimistic updates keyed by todo id with rollback on API error.

**Patterns to follow:**
- Repository pattern established in Unit 2.
- Global `.claude/rules/code-conventions.md` — boolean naming (`isOverdue`, `hasDueDate`), early returns, single parameter vs destructured object per arity.

**Test scenarios:**
- Happy path: `POST /api/todos` with valid payload persists and returns the new todo.
- Happy path: `PATCH /api/todos/:id` with `{ done: true }` updates the doc and the subsequent `list` returns it sorted to the Done section.
- Happy path: `DELETE /api/todos/:id` removes the doc.
- Edge case: sort order — mixed priorities and due dates are ordered exactly as specified (explicit fixture test).
- Edge case: todo with no `dueDate` sorts after todos with due dates at the same priority.
- Edge case: overdue flag applies only to incomplete todos, not completed ones.
- Error path: `POST` with empty text → 400; priority not in enum → 400; text over cap → 400.
- Error path: `PATCH` / `DELETE` with unknown id → 404.
- Integration (component): clicking the checkbox optimistically toggles UI, API error rolls back, toast surfaces the failure.

**Verification:**
- API and component tests pass.
- Manual: add, complete, delete, set priority and due date; refresh and confirm persistence.

---

- [ ] **Unit 7: Notes — API + UI**

**Goal:** Multiple short note cards with inline edit, rendered in the bottom-right region.

**Requirements:** R4, R5

**Dependencies:** Unit 2

**Files:**
- Create: `server/api/notes/index.get.ts`, `server/api/notes/index.post.ts`
- Create: `server/api/notes/[id].patch.ts`, `server/api/notes/[id].delete.ts`
- Create: `composables/useNotes.ts`
- Modify: `components/NotesSection.vue`
- Create: `components/NoteCard.vue`
- Test: `tests/server/api/notes.spec.ts`, `tests/components/NoteCard.spec.ts`

**Approach:**
- Cards render in a lightweight masonry/column layout that fits the editorial aesthetic.
- Inline edit: click card → contenteditable-style textarea; blur or Cmd/Ctrl+Enter saves via `PATCH`; Esc cancels.
- Debounce auto-save at 400 ms during active editing to avoid burst writes.
- Cap body length (e.g., 2000 chars) and title (e.g., 120 chars); reject empty bodies on create.
- Sort by `updatedAt` desc.

**Patterns to follow:**
- Mirror Unit 6's validation + optimistic update approach.

**Test scenarios:**
- Happy path: create → card appears at the top; edit → `updatedAt` changes and card moves back to top on next list.
- Happy path: delete → card disappears and backend confirms removal.
- Edge case: empty body on create → 400; trimmed-whitespace-only body treated as empty.
- Edge case: rapid typing within debounce window results in exactly one PATCH, with the final value.
- Error path: PATCH failure rolls back the card's displayed content to the last server-confirmed version.
- Integration (component): Esc cancels and restores the prior body; Cmd/Ctrl+Enter commits.

**Verification:**
- API and component tests pass.
- Manual: create a few notes, edit several, delete one; refresh and confirm order and content.

---

- [ ] **Unit 8: AWS Amplify deployment**

**Goal:** Deploy the SSR app to AWS Amplify Hosting with environment variables wired and Mongo Atlas reachable.

**Requirements:** R7

**Dependencies:** Units 1–7

**Files:**
- Create: `amplify.yml` (build spec)
- Modify: `nuxt.config.ts` (Nitro preset selection)
- Modify: `README.md` (deploy steps + env var checklist)

**Approach:**
- Select the Nitro preset supported by current Amplify Hosting for Nuxt 3 SSR. Confirm preset name against current Amplify documentation at deploy time (deferred detail — see Open Questions).
- `amplify.yml` installs dependencies, runs `nuxt build`, publishes the resulting artifact directory expected by Amplify's SSR compute.
- Configure Amplify env vars: `MONGO_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (Amplify domain + `/setup/callback`), `SETUP_SECRET`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`.
- MongoDB Atlas: dedicated DB user with least privilege on a single DB; IP allowlist `0.0.0.0/0` with strong password (since Amplify/Lambda IPs are not static); TLS on.
- Google Cloud console: register the deployed origin as an Authorized redirect URI matching `GOOGLE_REDIRECT_URI`.
- Add a healthcheck endpoint `server/api/health.get.ts` that returns 200 + build metadata (bypasses auth middleware).

**Test scenarios:**
- Test expectation: none — deployment configuration; validated by a post-deploy smoke verification.

**Verification (post-deploy smoke):**
- `/api/health` returns 200 on the Amplify URL.
- `/login` accepts `DASHBOARD_PASSWORD` and sets a session cookie.
- `/setup?secret=…` completes OAuth and persists a refresh token in Atlas.
- `/` renders today's events; creating a todo and a note persists across a hard refresh.
- A test event 6 minutes out fires a notification + chime at offset 5.

---

## System-Wide Impact

- **Interaction graph:** Client composables (`useSchedule`, `useAlarms`, `useTodos`, `useNotes`) share a single header/settings context via provide/inject or a lightweight store. The alarm scheduler depends on the schedule composable's event list; offset changes must propagate to both.
- **Error propagation:** Server routes map domain errors (invalid OAuth grant, validation failures, not-found) to specific HTTP codes; client surfaces non-blocking banners rather than replacing content with error states, so the dashboard remains usable if one section fails.
- **State lifecycle risks:** Fired-alarm state in `localStorage` must be namespaced by date to avoid stale blocks; scheduler must clear all timers on event refresh to avoid duplicate fires. Mongo connection must be reused across Nitro invocations to avoid connection storms in Lambda warm paths.
- **API surface parity:** No public/external API surface. All routes are internal to the dashboard and sit behind the password cookie (except `/setup` with secret and `/api/health`).
- **Integration coverage:** Unit 5's scheduler + Unit 4's refresh loop is the riskiest seam — integration test asserts no double-fire when events refresh mid-pending-timer. Unit 3's auth middleware must cover every `/api/*` route; an integration test enumerates routes to confirm.
- **Unchanged invariants:** N/A — greenfield project.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Alarms only fire while tab is open (accepted limitation) | Documented clearly in README; future v2 could add a service-worker push fallback. |
| Google refresh token revocation (password change, 6-month inactivity, scope change) | `/setup` is re-runnable; calendar service surfaces a "re-seed" CTA on `invalid_grant`. |
| Browser autoplay policies block the chime | `AudioUnlock` component forces a user gesture on first load before the scheduler ever needs to play audio. |
| MongoDB Atlas IP allowlist for dynamic Amplify IPs | Allow `0.0.0.0/0` with a strong, unique DB password + TLS + least-privilege user, or adopt an Atlas private-endpoint integration if available in the chosen region. |
| Amplify Nitro preset drift — deployment target for Nuxt 3 SSR changes over time | Preset selection is explicitly deferred to deploy time so current Amplify docs govern the choice; `/api/health` smoke-checks the deploy. |
| Secrets leakage | No secret logging; HTTPS enforced; HMAC-signed HttpOnly Secure SameSite=Lax cookies; refresh token stored only server-side in Mongo. |
| Clock skew between client and Google event times | Fire timing derived from server-provided ISO timestamps, computed against `Date.now()` on the client; 1–2 min skew is acceptable for a personal alarm. |

## Documentation / Operational Notes

- `README.md` covers local dev, required env vars, how to run `/setup`, and what happens when Google tokens are revoked.
- No external monitoring required for a personal app; Amplify's build/deploy logs and CloudWatch function logs are sufficient.
- Rollout: deploy on push to `main`. First deploy requires a manual `/setup` round-trip to seed the refresh token.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-13-personal-dashboard-requirements.md](../brainstorms/2026-04-13-personal-dashboard-requirements.md)
- Global conventions: `.claude/rules/code-conventions.md`, `.claude/rules/security.md`, `.claude/rules/frontend-design.md`, `.claude/rules/git-conventions.md`
- External docs (to be consulted at implementation time):
  - Google Calendar API v3 — `events.list`
  - Google OAuth 2.0 web-server flow (`offline` + `prompt=consent`)
  - Nuxt 3 Nitro deployment presets
  - AWS Amplify Hosting — Nuxt SSR support
  - MongoDB Node driver — connection reuse in serverless
