# Account Center And Logout Fix Plan

## Background

- the dedicated account page already exists at `/account/`
- the current account page reads like a stack of generic feature cards instead of a focused personal center
- user feedback on `http://127.0.0.1:18791/account/` identifies two concrete issues:
  - the page layout is visually messy and not a standard user-center experience
  - clicking logout can land on the workspace instead of staying on the login page

## Goal

Complete one focused repair pass that:

1. turns `/account/` into a clearer personal account center
2. makes portal logout reliably end at `/auth/`
3. tightens automated coverage so the same regression is caught next time

## Root Cause Hypothesis

### Logout bounce

- the account page already sends logout to `/auth/`
- the auth page auto-redirects authenticated users away from `/auth/`
- the session bootstrap path is currently too trusting:
  - it does not explicitly bypass browser caching in the frontend
  - the server session endpoint does not explicitly mark auth session responses as `no-store`
- if a stale authenticated session response is reused, `/auth/` can redirect back into the product after logout

### Account page disorder

- the current page is composed as generic cards:
  - profile
  - password form
  - quick links
  - principle copy
- the information hierarchy is weak:
  - there is no strong profile summary
  - security actions and navigation actions are visually equal
  - supporting copy occupies too much space relative to useful controls

## Scope Decision

Include:

- logout reliability fixes in shared auth/session browser flow
- `/account/` markup, copy, and CSS restructuring
- focused test updates for portal logout and account-page expectations
- execution logging in `docs/dev`

Exclude:

- admin page redesign
- auth page redesign beyond logout correctness
- changes to registration policy

## Design Direction

Use a standard member-center layout:

1. a concise hero with account identity and current status
2. a left-side overview area for profile and quick actions
3. a right-side primary security area for password management
4. shorter explanatory copy with clear labels and hierarchy

Visual intent:

- cleaner grid structure
- stronger section headings
- fewer equal-weight cards
- keep existing product visual language instead of introducing a disconnected style

## Execution Order

### Phase 1: Planning And Guardrails

1. create this plan
2. create the paired execution log
3. inspect current logout/session code and account markup dependencies

Acceptance:

- the task is documented and the affected files are known before code edits

### Phase 2: Logout Reliability

1. harden session fetching so auth/session checks bypass cache
2. mark server auth session responses as non-cacheable
3. make shared portal logout fail loudly if the session is still active after logout

Acceptance:

- logout from portal pages ends on `/auth/`
- auth page does not bounce a just-logged-out user back into the workspace

### Phase 3: Account Center Redesign

1. replace the current stacked card layout with a clearer account dashboard
2. preserve existing IDs needed by scripts/tests unless there is a strong reason to change them
3. simplify copy and emphasize:
  - identity
  - security
  - quick actions

Acceptance:

- `/account/` reads as a standard user-facing personal center
- the page is coherent on desktop and mobile

### Phase 4: Verification

1. update markup/state/smoke coverage where needed
2. run focused tests first
3. run broader regression after the UI and logout behavior are stable

Acceptance:

- account/logout regressions are covered by automation

## Risks To Watch

1. making auth-page session checks too aggressive and breaking legitimate logged-in redirects
2. redesigning markup in a way that breaks existing JS bindings
3. improving desktop layout but regressing mobile spacing or navigation

## Phase-End Review Requirement

After each phase, record:

- new problems found
- missed edge cases
- fixes or plan updates applied
