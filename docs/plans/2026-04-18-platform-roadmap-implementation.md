# AI Content Platform Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current single-instance AI creation site into a structured, multi-user, server-deployable content platform with durable users, preferences, usage tracking, task persistence, template management, and admin-ready foundations.

**Architecture:** Keep the current single Node server and static frontend, but move all business state behind server APIs backed by SQLite. Continue the existing modular backend pattern (`server/routes/*`, `server/state-store.js`) and evolve it into a proper application state layer rather than scattering state across frontend storage and in-memory Maps.

**Tech Stack:** Node.js built-in HTTP server, `node:sqlite` with WAL mode, vanilla frontend JS, SQLite-backed state store, existing regression scripts in project root.

---

### Task 1: Freeze The Product Boundary

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\docs\plans\2026-04-18-platform-roadmap-implementation.md`
- Reference: `E:\Agents\AI-Generation-Stations\public\index.html`
- Reference: `E:\Agents\AI-Generation-Stations\public\js\app.js`

**Step 1: Document target users and product scope**

Write down the four core user groups:
- content creators
- music creators
- small teams/operators
- admins/internal operators

List the current supported feature groups:
- chat
- lyrics
- music
- image cover
- speech
- voice cover

**Step 2: Document what is explicitly out of scope for this phase**

Keep out of scope:
- open public registration
- billing integration
- team workspaces
- object storage / CDN migration
- background workers / job queue
- OAuth / SSO

**Step 3: Define acceptance criteria for this roadmap phase**

Acceptance criteria:
- all core features are user-bound
- all user state is server-side
- no critical feature depends on browser-only storage
- regression suite remains green

**Step 4: Commit**

```bash
git add docs/plans/2026-04-18-platform-roadmap-implementation.md
git commit -m "docs: define platform roadmap boundary"
```

### Task 2: Finish The User Domain In SQLite

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\server\state-store.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\config.js`
- Test: `E:\Agents\AI-Generation-Stations\test-auth-history.js`

**Step 1: Add the missing user table helpers**

Add explicit store methods for:
- `getUserById`
- `getOrCreatePreferences`
- `updatePreferences`
- `incrementUsageDaily`
- `getUsageDaily`

**Step 2: Normalize all session methods around `user_id`**

Ensure:
- sessions only store `user_id`
- session read joins user metadata
- password auth updates `last_login_at`

**Step 3: Add default preference row bootstrap**

When a user has no preferences row, create one with sensible defaults:
- theme
- default chat model
- default voice
- default music style
- default cover ratio

**Step 4: Add tests for preferences and usage**

Extend `test-auth-history.js` to verify:
- preferences can be read
- preferences can be updated
- usage counters increment and return expected values

**Step 5: Run tests**

Run:

```bash
npm run test:auth-history
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add server/state-store.js server/config.js test-auth-history.js
git commit -m "feat: complete sqlite user preferences and usage store"
```

### Task 3: Add Auth + Preferences + Usage APIs

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\state.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\route-meta.js`
- Test: `E:\Agents\AI-Generation-Stations\test-auth-history.js`

**Step 1: Add preferences API routes**

Add:
- `GET /api/preferences`
- `POST /api/preferences`

Request/response should be JSON only.

**Step 2: Add usage API route**

Add:
- `GET /api/usage/today`

Return:
- counts for each feature
- usage date
- user id / username summary if useful

**Step 3: Keep auth enforcement centralized**

Use the same `requireUser()` helper for:
- history
- preferences
- usage

**Step 4: Extend tests**

Add test cases for:
- unauthenticated preferences request returns `401`
- authenticated preference update persists
- usage route returns zero/defaults before activity

**Step 5: Run tests**

```bash
npm run test:auth-history
node test-regression.js --skip-live --port 18797
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add server/routes/state.js server/route-meta.js test-auth-history.js
git commit -m "feat: expose preferences and usage APIs"
```

### Task 4: Connect Frontend Preferences To Real User State

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\public\js\app-shell.js`
- Modify: `E:\Agents\AI-Generation-Stations\public\js\app.js`
- Test: `E:\Agents\AI-Generation-Stations\test-frontend-state.js`
- Test: `E:\Agents\AI-Generation-Stations\test-page-markup.js`

**Step 1: Add remote preference calls in `app-shell.js`**

Add methods:
- `getPreferences`
- `savePreferences`
- `getUsageToday`

**Step 2: Replace local theme-only preference behavior**

When user logs in:
- fetch preferences
- apply theme and defaults from server

When user changes:
- theme
- chat model
- speech voice
- music style
- cover ratio

Persist them through the preferences API.

**Step 3: Add debounced preference saving**

Do not send one request per keystroke.
Only persist meaningful preference changes.

**Step 4: Extend frontend tests**

Add checks that:
- remote persistence adapter exposes preference methods
- page still includes required auth/history/template anchors

**Step 5: Run tests**

```bash
npm run test:frontend
node test-regression.js --skip-live --port 18797
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add public/js/app-shell.js public/js/app.js test-frontend-state.js test-page-markup.js
git commit -m "feat: bind frontend preferences to server state"
```

### Task 5: Track Real Feature Usage

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\state.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\service.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\tasks\lyrics.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\tasks\music.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\tasks\image.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\tasks\voice-cover.js`
- Test: `E:\Agents\AI-Generation-Stations\test-auth-history.js`

**Step 1: Define usage increment points**

Increment on successful completion for:
- chat
- lyrics
- music
- image
- speech
- cover

Do not increment on validation failure or upstream failure.

**Step 2: Thread user identity where needed**

If the request is authenticated:
- increment daily counters after success

If unauthenticated:
- skip usage tracking or return `401` for protected state paths only

**Step 3: Add tests**

At minimum validate:
- usage starts at zero
- one successful history append + one successful feature event increments the correct bucket

**Step 4: Run tests**

```bash
npm run test:auth-history
node test-regression.js --skip-live --port 18797
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add server/routes/state.js server/routes/service.js server/routes/tasks/lyrics.js server/routes/tasks/music.js server/routes/tasks/image.js server/routes/tasks/voice-cover.js test-auth-history.js
git commit -m "feat: track per-user daily feature usage"
```

### Task 6: Persist Task State For Server Restarts

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\server\state-store.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\index.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\local.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\tasks\music.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\tasks\image.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\tasks\voice-cover.js`
- Test: `E:\Agents\AI-Generation-Stations\test-failures.js`

**Step 1: Add a `tasks` table**

Store:
- task id
- user id nullable
- feature
- status
- progress
- input payload
- output payload
- error
- created_at
- updated_at

**Step 2: Replace in-memory only status for core async tasks**

Migrate:
- music
- image
- cover

Keep the existing response contract unchanged.

**Step 3: Make `/status` routes read from persistent task state**

This should survive server restart.

**Step 4: Add restart-safe regression**

Either:
- extend `test-failures.js`
- or create `test-task-persistence.js`

Validate:
- task row exists
- status route can read persisted task state

**Step 5: Run tests**

```bash
node test-regression.js --skip-live --port 18797
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add server/state-store.js server/index.js server/routes/local.js server/routes/tasks/music.js server/routes/tasks/image.js server/routes/tasks/voice-cover.js test-failures.js
git commit -m "feat: persist async task status in sqlite"
```

### Task 7: Productize The Template System

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\server\state-store.js`
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\state.js`
- Modify: `E:\Agents\AI-Generation-Stations\public\js\app-shell.js`
- Modify: `E:\Agents\AI-Generation-Stations\public\js\app.js`
- Test: `E:\Agents\AI-Generation-Stations\test-frontend-state.js`

**Step 1: Add system/user template tables**

Tables:
- `system_templates`
- `user_templates`
- optionally `user_template_favorites`

**Step 2: Seed current hard-coded templates into system templates**

Do not keep templates only in frontend source.

**Step 3: Add template APIs**

Add:
- `GET /api/templates/:feature`
- `POST /api/templates/:feature`
- `POST /api/templates/:feature/:id/favorite`

**Step 4: Switch frontend template rendering to API data**

Keep the current UI shell if possible.

**Step 5: Run tests**

```bash
npm run test:frontend
node test-regression.js --skip-live --port 18797
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add server/state-store.js server/routes/state.js public/js/app-shell.js public/js/app.js test-frontend-state.js
git commit -m "feat: move templates into server-managed data"
```

### Task 8: Add Admin Basics

**Files:**
- Modify: `E:\Agents\AI-Generation-Stations\server\routes\state.js`
- Modify: `E:\Agents\AI-Generation-Stations\public\index.html`
- Modify: `E:\Agents\AI-Generation-Stations\public\js\app.js`
- Test: `E:\Agents\AI-Generation-Stations\test-auth-history.js`

**Step 1: Add admin-only user listing API**

Add:
- `GET /api/admin/users`

Return:
- user summary
- status
- role
- plan
- last login

**Step 2: Add admin-only user update API**

Add:
- `POST /api/admin/users/:id`

Allow:
- disable/enable user
- change role
- change plan

**Step 3: Add a minimal admin panel placeholder**

Do not overbuild.
One simple user table is enough for this phase.

**Step 4: Run tests**

```bash
npm run test:auth-history
node test-regression.js --skip-live --port 18797
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add server/routes/state.js public/index.html public/js/app.js test-auth-history.js
git commit -m "feat: add basic admin user management"
```

### Task 9: Final Full Regression And Release Check

**Files:**
- Verify: `E:\Agents\AI-Generation-Stations\package.json`
- Verify: `E:\Agents\AI-Generation-Stations\test-regression.js`
- Verify: all touched backend/frontend files

**Step 1: Run frontend checks**

```bash
npm run test:frontend
```

Expected:
- PASS

**Step 2: Run auth/history checks**

```bash
npm run test:auth-history
```

Expected:
- PASS

**Step 3: Run full regression**

```bash
npm run test:regression -- --port 18797
```

Expected:
- PASS

**Step 4: Manual smoke verification**

Verify:
- login works
- history restores per user
- preference changes persist
- one content generation increments usage
- one async task survives page refresh

**Step 5: Commit release checkpoint**

```bash
git add .
git commit -m "chore: finish platform state roadmap phase"
```

Plan complete and saved to `docs/plans/2026-04-18-platform-roadmap-implementation.md`.

The next implementation batch should follow this exact order:
1. user preferences + usage
2. task persistence
3. template backend
4. admin basics
5. full regression and release checkpoint
