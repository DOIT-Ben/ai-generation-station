# Product UI Contract Baseline

## Purpose

Freeze the frontend baseline before any new visual cleanup starts.

This document defines what counts as the shared product shell for the current user-facing baseline. Any later UI change must either follow these rules or explicitly justify why it is a controlled exception.

## Scope

This contract applies to:

- `public/index.html`
- `public/css/style.css`
- `public/js/app.js`
- `public/js/app-shell.js`

It covers:

- page shell
- standard cards
- chat workspace shell
- button hierarchy
- top-right utility cluster
- light/dark theme surfaces
- allowed exceptions

## Surface Inventory

The current visible product surfaces are:

1. left sidebar navigation
2. top-right utility cluster
3. page section header
4. standard feature card
5. chat page card
6. chat workspace shell
7. result surfaces
8. auth gate
9. admin panel surface

These must feel like one product family, not a set of unrelated mini-tools.

## Page-Shell Rules

### Sidebar

- Sidebar width is fixed at `272px` on desktop.
- Tablet may reduce width to `232px`.
- Mobile sidebar may slide in, but must remain the same visual family.
- Sidebar is a navigation shell, not a generic content card.

### Main Content

- Main content starts after the sidebar and uses `margin-left` matching sidebar width.
- Desktop padding baseline is `88px 48px 40px`.
- Mobile reduces padding, but must preserve the same visual rhythm rather than inventing a new layout model.

### Section Header

- Every major page starts with a section header.
- Section header is not a card.
- Header copy establishes page identity and should remain visually lighter than the main card body.

## Card Contract

### Standard Page Card

The default content container is `.card`.

Required traits:

- background from the shared elevated surface
- visible but subtle border
- large rounded corners using the shared radius scale
- shared shadow family
- desktop padding `32px`
- no page should redefine these fundamentals unless there is a written exception

### Standard Card Role

Use `.card` for:

- lyrics
- image generation
- speech synthesis
- music generation
- voice cover
- standalone result blocks

### Chat Page Card

- `.chat-card` inherits the standard `.card` family.
- `.chat-card` may control width or local layout fit only.
- `.chat-card` must not replace the shared card background, border, radius, or shadow language.
- Chat must feel like one tab inside the same product, not a separate app.

### Chat Workspace Shell

`.chat-container` is allowed to be a workspace shell inside the card because chat has a two-column conversational workspace.

Allowed differences:

- grid split between conversation list and main thread
- taller minimum height than standard generator pages
- local internal panels for sidebar and message area

Not allowed:

- introducing a second product identity
- using a card language that visually conflicts with `.card`
- floating/centering behavior that makes chat feel detached from other pages

## Button Hierarchy

### Primary

Use primary buttons for start/generate/send actions:

- `生成`
- `开始`
- `发送`
- `登录`

Primary buttons are for the main action of the current context.

### Secondary

Use secondary buttons for supporting but still meaningful actions:

- download
- rename
- archive
- open a new conversation inside the page body

### Utility

Utility actions must remain visually restrained:

- theme toggle
- account state
- logout

These actions belong to the top-right utility cluster and must not visually overpower the page.

### Explicit Rule

`退出` is a utility action by default.

It must not borrow the visual weight of a primary generator CTA unless there is a very explicit product reason.

## Top-Right Utility Cluster Contract

The top-right cluster currently contains:

- theme toggle
- login button or account state
- logout action when authenticated

Rules:

- these controls share one height rhythm
- these controls share one corner language
- these controls read as a utility bar, not a hero action row
- theme toggle stays to the left of login/account state
- account presentation may contain identity detail, but it must stay compact

## Theme Contract

### Dark Theme

- dark theme uses deep layered surfaces with restrained neon accents
- borders remain subtle
- shadows create depth, not noise

### Light Theme

- light theme uses warm off-white and soft paper-like surfaces
- light theme must not fall back to arbitrary gray blocks
- borders remain understated
- contrast should come from depth and spacing first, not from stacking frames everywhere

### Shared Constraint

No page should accumulate unnecessary nested borders just because the theme changed.

If a surface already reads clearly through background, spacing, and shadow, another border is usually a mistake.

## Allowed Exceptions

Allowed only with explicit justification:

- chat workspace min-height rules
- mobile-only layout collapse rules
- page-internal panels required by complex tools such as chat

Not allowed without explicit justification:

- page-specific card background systems
- custom max-width logic that breaks sibling-page comparison
- top-right controls that use a different action hierarchy
- light-theme overrides that introduce gray filler surfaces inconsistent with the rest of the product

## Forbidden Drift Patterns

The following are now explicitly forbidden:

1. solving one local page complaint without comparing against sibling pages
2. letting `.chat-card` become a second design system
3. styling top-right utility actions like hero CTAs
4. adding borders because a surface feels empty instead of fixing spacing/hierarchy
5. treating green functional tests as proof of visual closeout

## Manual Review Checklist

Before closing any future frontend visual round, compare:

1. chat page card vs one standard generator card
2. top-right utility cluster in both dark and light theme
3. desktop vs tablet vs mobile
4. auth gate vs normal page card
5. one unchanged sibling page after the edit

The round is not closed if any edited area looks like a different product family.

## Automated Visual Baseline

The contract is now backed by a small screenshot-diff gate in:

- `test-ui-visual.js`
- `test-artifacts/visual-baseline`

Current tracked captures:

1. `auth-gate-card`
2. `utility-cluster-authenticated`
3. `admin-panel`
4. `chat-card-dark`
5. `chat-card-light`
6. `lyrics-card-light`

Update rule:

- change the baseline only after the UI change is intentionally reviewed
- use `node test-ui-visual.js --port 18797 --launch-server --update-baseline`
- do not refresh baselines just to suppress unexplained drift
