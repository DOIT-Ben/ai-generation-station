# Admin Audit Center Plan

## Mainline

- Active phase: `P10 Admin Audit Center`
- Source queue:
  - approved post-`P9` follow-up TODO list

## Goal

Expose the audit logs added in `P7` through a usable admin-only management surface.

## Chosen Scope

Backend:

- one paginated admin audit API
- action / actor / target / time-range filters

Frontend:

- one admin audit panel inside the existing admin section
- loading / empty / error states
- previous / next pagination
- expandable details JSON view

Not included:

- export/download
- charts
- full-text search across JSON details

## Chosen Approach

### Backend

Add `GET /api/admin/audit-logs` with query-string filters.

Reason:

- it matches the existing admin route family
- pagination and filters are easy to express with query params
- it keeps the write-side audit table unchanged

### Frontend

Use a responsive table with horizontal overflow on small screens.

Reason:

- audit data is inherently tabular
- admins need quick scanning by time/action/actor/target
- a table plus expandable details is sufficient for the first pass

## Validation Plan

1. anonymous access should return `401`
2. non-admin access should return `403`
3. admin access should return paginated items
4. action / actor / target filters should narrow results correctly
5. frontend should render:
   - table rows
   - empty state
   - pagination state
   - detail disclosure
6. run focused tests:
   - `node test-auth-history.js`
   - `node test-frontend-state.js`
   - `node test-page-markup.js`
   - `node test-ui-flow-smoke.js --port 18797 --launch-server`
7. if visuals change materially:
   - `node test-ui-visual.js --port 18797 --launch-server`

## Known Limits

- current audit filters are indexed for action and target user, but not for every free-form filter combination
- time-range filtering will stay simple integer timestamp matching
