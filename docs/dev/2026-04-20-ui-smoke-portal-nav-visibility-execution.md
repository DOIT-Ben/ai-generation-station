# UI Smoke Portal Nav Visibility Execution

## Background

- real repo sync was already applied to `E:\Agents\AI-Generation-Stations`
- local service startup succeeded
- direct HTTP checks for:
  - `/`
  - `/auth/`
  - `/account/`
  - `/admin/`
  all returned `200`
- browser smoke was then run with:
  - `npm run test:ui-flow`

## Problem

- browser smoke failed on:
  - `locator('#portal-user-nav').waitFor({ state: 'visible' })`
- observed behavior:
  - the visible navigation chrome was rendered inside `#portal-user-nav`
  - the element matched by the test was only an empty wrapper
  - the actual fixed-position navigation lived in a nested child

Result:

- users could see the nav
- Playwright still treated `#portal-user-nav` as hidden because the wrapper itself had no visible box

## Fix

- updated `public/js/site-shell.js`
- changed `renderPortalUserNav()` to render the nav directly onto `#portal-user-nav`
- kept the same visual structure and controls:
  - workspace link
  - account/admin links
  - login/register or logout actions
- updated `public/css/style.css`
- added a global hidden-state rule:
  - `[hidden] { display: none !important; }`

Reason:

- generic hidden elements such as `#account-admin-link` were still inheriting visible layout from shared button styles
- portal panes already had local hidden rules, but generic button links did not
- mobile workspace topbar collapsed the entire account-copy block, so the current username disappeared from the rendered text
- mobile sidebar overlay covered the full viewport, so an automated center click landed under the open sidebar instead of the close zone

## Validation

- local service:
  - healthy on `http://127.0.0.1:18791/`
- HTTP page checks:
  - `/` returned `200`
  - `/auth/` returned `200`
  - `/account/` returned `200`
  - `/admin/` returned `200`
- browser smoke:
  - rerun required after the hidden-state fix

## Single-Task Closeout Review

### New Problem Found

- UI smoke used a wrapper selector whose descendant was visible but whose own layout box was not

### Missed Edge

- manual HTTP checks and visual inspection logic were not enough to guarantee Playwright visibility semantics

### Fix Applied

- aligned DOM ownership with the smoke selector so the tested node is the visible node
- restored global HTML hidden semantics so button/link components cannot visually override `hidden`
- restored mobile username visibility in the workspace topbar while keeping the secondary summary collapsed
- constrained the mobile sidebar overlay to the non-sidebar area so close clicks consistently hit the overlay
