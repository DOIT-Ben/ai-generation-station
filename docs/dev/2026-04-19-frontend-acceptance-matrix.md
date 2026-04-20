# Frontend Acceptance Matrix

## Purpose

Define one repeatable acceptance pass for the current user-facing baseline.

This matrix complements automated checks. It does not replace them.

## Why The Old Smoke Baseline Was Not Enough

The existing `test-suite.js` smoke checks are useful, but they mainly prove:

- homepage responds
- a few endpoints answer
- parameter validation exists
- some failure paths do not crash

They do not prove:

- card scale is consistent across pages
- light theme still matches the same product family
- top-right utility controls behave correctly
- auth invalidation is handled intentionally in the UI

## Automated Gates Used In This Mainline

The stronger frontend-oriented gates now are:

1. `node test-page-markup.js`
   - protects UI anchors and key localized copy
2. `node test-style-contract.js`
   - protects shared card and utility-shell structure
3. `node test-frontend-state.js`
   - now covers auth-expired event dispatch in remote persistence
4. `node test-auth-history.js`
   - covers disabled login, temporary lockout, admin self-protection, and expired-session responses
5. `node test-ui-flow-smoke.js`
   - runs a real Chromium browser smoke journey for:
   - homepage load
   - auth gate visibility
   - bootstrap login
   - admin-panel visibility
   - page tab switch
   - theme toggle
   - logout return to locked state
   - mobile sidebar open and close
   - mobile nav switch after sidebar open
6. `node test-ui-visual.js`
   - runs screenshot-diff checks for:
   - auth gate card
   - authenticated utility cluster
   - admin panel
   - chat card in dark theme
   - chat card in light theme
   - lyrics page card in light theme

Decision:

- browser automation is now included at the smallest practical level
- first pass still stays intentionally narrow:
  - desktop smoke plus one narrow mobile viewport
  - desktop visual baseline on six key surfaces
  - no tablet screenshot layer yet

## Manual Acceptance Pass

### Desktop

Viewport:

- `>= 1280px`

Check:

- sidebar width and spacing remain stable
- chat card and generator cards feel like one system
- top-right theme toggle and account area align visually
- light theme does not introduce arbitrary gray filler blocks
- browser smoke now automates the basic desktop shell journey, but visual polish still requires manual review

### Tablet

Viewport:

- around `768px` to `1023px`

Check:

- sidebar width reduction does not break the layout
- chat workspace still reads clearly
- top-right utility cluster stays usable and aligned

### Mobile

Viewport:

- `< 768px`

Check:

- mobile sidebar opens and closes cleanly
- chat workspace collapses without broken overflow
- top-right utility cluster remains visible and tappable
- auth gate remains readable

Current state:

- narrow-screen browser automation now exists for:
  - login
  - theme toggle
  - sidebar open
  - overlay close
  - nav switch with sidebar auto-close
- tablet remains manual-only in this phase

## Theme Acceptance

### Dark Theme

Check:

- primary actions stay visually dominant only where intended
- utility actions do not compete with primary CTAs
- nested borders do not accumulate in chat

### Light Theme

Check:

- cards stay warm and soft, not muddy gray
- chat workspace internal surfaces remain from the same family as standard cards
- utility bar still feels light and controlled

## Account-State Acceptance

### Anonymous

Check:

- auth gate visible
- top-right shows login button only
- app remains visually locked

### Authenticated User

Check:

- auth gate hidden
- top-right shows user identity and logout utility action
- admin panel hidden

### Authenticated Admin

Check:

- admin panel visible
- admin actions load successfully
- self-disable and self-demotion are rejected if attempted through the backend

### Session Expired

Check:

- protected request returns user to the auth gate
- top-right account state disappears
- user gets the localized session-expired message

## Page Checks

For each manual round, inspect at least:

1. chat
2. lyrics
3. speech
4. auth gate
5. admin panel when logged in as admin

## Closeout Rule

The frontend round is not closed if any of these happen:

1. chat looks like a different product from generator pages
2. logout or theme controls overpower the utility cluster
3. expired-session behavior leaves stale account UI on screen
4. light theme falls back to gray block layering instead of shared surface language

## Known Limits

- browser automation currently covers only the admin bootstrap account path
- it does not verify generator submission flows
- it does not yet assert tablet-specific layout behavior
- visual regression does not yet cover tablet/mobile screenshots or dynamic result states
