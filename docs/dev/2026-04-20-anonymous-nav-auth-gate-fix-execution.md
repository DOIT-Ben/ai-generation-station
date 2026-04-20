# Anonymous Nav Auth Gate Fix Execution Log

## Mainline

- Date: `2026-04-20`
- Scope: `anonymous desktop navigation feedback` + `auth-gate lock behavior`
- Trigger: user reported `点击导航栏没有变化`

## Problem Statement

- Anonymous users could see the desktop sidebar navigation.
- Clicking a nav item appeared to do nothing before login.
- Root cause was not the tab switcher itself.
- The fixed full-screen `#auth-gate` plus `.app.auth-locked { pointer-events: none; }` blocked the visible sidebar before the click could reach `.nav-item`.

## Granular TODO

1. Reconfirm the anonymous-state event interception path and preserve auth locking semantics.
2. Narrow the auth-gate lock scope so desktop sidebar navigation remains interactive.
3. Keep protected workspace actions blocked before login.
4. Add regression coverage for anonymous desktop nav switching.
5. Run focused and broad regression.
6. Archive the fix, missed assumptions, and boundary conditions under `docs/dev`.

## Execution Log

### Task 1: Reconfirm Root Cause

- Reproduced the problem against the running local service.
- Confirmed authenticated navigation already worked.
- Confirmed anonymous desktop nav clicks were intercepted by `#auth-gate`.

New problems surfaced:

- The product visually exposed a clickable sidebar while interaction semantics still treated the entire app shell as locked.

Boundary conditions handled:

- Kept the core requirement that anonymous users must not interact with main workspace controls.

Missed earlier assumptions:

- “Visible” sidebar was treated as equivalent to “usable” sidebar during the auth-lock implementation, which created a misleading dead UI state.

### Task 2: Scope Auth Lock To The Main Workspace

- Updated [`public/css/style.css`](E:\Agents\AI-Generation-Stations\public\css\style.css) so `.auth-gate` starts at the desktop/tablet sidebar edge instead of covering the full viewport.
- Kept mobile behavior full-screen by resetting `.auth-gate` to `left: 0` under the mobile breakpoint.
- Replaced the global `.app.auth-locked` pointer-event block with `.app.auth-locked .main`, so the main workspace remains locked while the desktop sidebar stays interactive.

New problems surfaced:

- The lock model had been implemented at the container level, which was broader than the real protection boundary.

Boundary conditions handled:

- Desktop sidebar remains clickable before login.
- Main workspace continues to reject pointer interaction before login.
- Mobile keeps the full-screen auth cover because the sidebar is drawer-based there.

Missed earlier assumptions:

- The auth overlay did not need to own the sidebar hit area to protect content creation actions.

### Task 3: Add Regression Coverage

- Extended [`test-ui-flow-smoke.js`](E:\Agents\AI-Generation-Stations\test-ui-flow-smoke.js) with an anonymous desktop navigation assertion.
- New coverage verifies:
  - anonymous click on `.nav-item[data-tab="lyrics"]` activates the nav and tab
  - `#auth-gate` stays visible
  - the protected lyrics generate action is still geometrically covered by the auth gate

New problems surfaced:

- Existing browser smoke coverage only exercised nav switching after login, so this dead-click state could regress silently.

Boundary conditions handled:

- Regression now distinguishes “sidebar should react” from “workspace must stay locked”.

Missed earlier assumptions:

- Post-login smoke assertions were not enough to validate the anonymous shell contract.

### Task 4: Verification

- Verified against the already running local service at `http://127.0.0.1:18791/` that anonymous desktop nav now switches to `lyrics` while auth remains required.
- Ran:
  - `node test-page-markup.js`
  - `node test-style-contract.js`
  - `node test-ui-flow-smoke.js --port 18797 --launch-server`
  - `node test-ui-visual.js --port 18798 --launch-server`
  - `. 'D:\document\PowerShell\profile.ps1'; node test-regression.js --skip-live --port 18799`

Result:

- focused UI checks passed
- visual regression passed with `0 px` diff on all tracked captures
- skip-live regression passed `12/12`

New problems surfaced:

- None after the scoped lock fix and smoke coverage update.

Boundary conditions handled:

- Visual baseline remained valid; no baseline refresh was required.

Missed earlier assumptions:

- The existing screenshot plan only captured the auth card itself, so it did not expose full-page overlay hit-area mistakes.

## Outcome

- Anonymous desktop sidebar navigation now gives visible state change instead of appearing dead.
- Main workspace actions remain blocked until login.
- Mobile auth lock behavior remains unchanged.

## Files Changed

- [`public/css/style.css`](E:\Agents\AI-Generation-Stations\public\css\style.css)
- [`test-ui-flow-smoke.js`](E:\Agents\AI-Generation-Stations\test-ui-flow-smoke.js)
