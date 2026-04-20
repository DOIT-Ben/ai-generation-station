# Email Identity Baseline Plan

## Mainline

- Active phase: `P15 Email Identity Baseline`

## Goal

Make `email` a validated, test-covered account attribute so invitation and recovery delivery can move beyond `local_preview` without another user-model refactor.

## Scope

In scope for this round:

- backend email normalization and validation
- email uniqueness enforcement
- admin create-user email support
- admin update-user email support
- admin list email visibility
- focused backend/frontend/markup coverage
- docs/dev archive updates

Out of scope for this round:

- real email delivery
- mandatory email requirement for every account
- self-service public registration
- email verification

## Granular TODO

1. Re-read `server/state-store.js` and confirm `email` already exists in SQLite.
2. Add `getUserByEmail()` to the state store.
3. Extend admin user update persistence to write email changes.
4. Add backend email normalization helper in `server/routes/state.js`.
5. Add backend email format validation.
6. Add backend duplicate-email rejection.
7. Extend admin create-user route to accept and persist email.
8. Extend admin update-user route to accept and persist email.
9. Add admin create-user email field in `public/index.html`.
10. Add admin user-list email display and a minimal email edit affordance in `public/js/app.js`.
11. Extend frontend state tests so admin create/update payloads include email.
12. Extend backend auth tests for:
    - invalid email create reject
    - duplicate email create reject
    - email update persistence
    - duplicate email update reject
    - admin user listing returns email
13. Extend page-markup tests for the new email controls.
14. Run focused validation:
    - `node test-auth-history.js`
    - `node test-frontend-state.js`
    - `node test-page-markup.js`
    - `node test-ui-flow-smoke.js --port 18797 --launch-server`
15. Update docs:
    - auth rules
    - release checklist
    - archive index
    - execution log

## Acceptance

- admin can create and maintain user email addresses intentionally
- invalid and duplicate email values are rejected explicitly
- the admin UI shows email state instead of hiding it in the data model
