# Mobile Responsive Acceptance Execution Log

## Mainline

- Active mainline: `Mobile + Responsive Acceptance Hardening`
- Source TODO:
  - `docs/dev/2026-04-19-post-p0-p2-next-granular-todo.md`

## Goal

Close the first remaining frontend acceptance gap after the desktop/browser baseline:

- mobile sidebar behavior
- right-top utility cluster stability
- auth gate readability
- chat/layout wrapping on narrow screens

## Known Baseline Before Changes

- desktop browser smoke already exists and passes
- current responsive CSS already has a mobile branch, but it still needs tighter spacing and utility clustering
- the acceptance matrix still treats mobile behavior as manual-only

## Initial Risk Review

- the top-right utility cluster can get visually compressed on narrow screens
- the chat workspace can become too tall or too crowded when the sidebar collapses
- the admin panel needs compact stacking so the new account-operations forms do not dominate the mobile layout
- the browser smoke currently only verifies a desktop viewport

## Implementation Notes

- tightened mobile width handling in `public/css/style.css` so the main workspace resets to full width on narrow screens instead of inheriting desktop `max-width` constraints
- tightened the top-right utility cluster on mobile with:
  - explicit left/right bounds
  - max-width limits for the login/account slot
  - smaller compact account presentation
- tightened chat mobile layout with:
  - wrapped input row behavior
  - full-width model selector
  - more stable narrow-screen chat height rules
- tightened auth gate readability on mobile with:
  - top-aligned overlay
  - lighter card padding
  - vertically stacked highlight rows
- tightened admin/account-operations forms so they stack cleanly on narrow screens
- changed toast layering so the toast container no longer blocks unrelated pointer interactions underneath
- extended `test-ui-flow-smoke.js` to cover:
  - desktop flow
  - mobile login
  - mobile theme toggle
  - mobile sidebar open
  - mobile overlay close
  - mobile nav switch with auto-close

## Concrete Issues Found

1. mobile `.main` width was still inheriting the desktop width contract
2. mobile smoke initially failed because responsive layout intentionally hides the username text at narrow width
3. toast container positioning could intercept overlay and sidebar clicks on mobile

## Decisions

- tablet stays manual-only for this phase to keep the smoke suite small and stable
- mobile browser automation is now part of the main smoke path
- mobile account-state assertion now checks authenticated state instead of requiring visible username text

## Verification

Validated on April 19, 2026:

- `node test-ui-flow-smoke.js --port 18797 --launch-server`
  - passed

## Boundary Conditions Handled

- compact mobile login state may hide the username text while still remaining a valid authenticated state
- overlay-close checks cannot depend on click positions that may be covered by non-interactive chrome like toasts
- auth gate needs scrollable/top-aligned behavior on smaller screens rather than strict centered-card assumptions

## Missed Earlier Assumptions Corrected

- desktop browser smoke was not enough to claim responsive stability
- the original smoke assertions assumed desktop-visible account text and did not respect responsive copy-hiding rules
