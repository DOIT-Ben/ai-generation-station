# Personal Daily-Use Polish Plan

## Background

- The product already has separated auth, account, admin, and workspace surfaces.
- Release, notification, and operator-readiness work are already closed for the current round.
- The user's target has shifted from "complete baseline product" to "the version I can personally use every day and everything feels smooth".
- The highest remaining friction is no longer missing features.
- The remaining friction is continuity:
  - the workspace does not reliably remember where the user left off
  - drafts are easy to lose on refresh or page transitions
  - chat resumes from the newest conversation, not necessarily the last working conversation
  - reset actions clear the visible form but do not act like an intentional "discard this draft" flow

## Goal

Complete one bounded polish pass that improves daily repeated usage without reopening product scope.

This pass should make the workspace behave more like a personal studio:

1. reopen into the user's last working context
2. preserve unfinished drafts across reloads and short interruptions
3. make the saved state visible enough that the behavior feels intentional
4. keep the implementation inside the existing account/preferences model

## Scope Decision

Include:

- workspace resume-state design
- per-feature draft persistence for high-frequency forms
- last-active tab persistence
- last-active chat conversation persistence
- explicit draft discard behavior wired into existing reset flows
- a lightweight workspace resume/status surface in the main UI
- regression updates
- `docs/dev` planning and execution logging

Exclude:

- new generation features
- new admin/account product scope
- major chat composer redesign
- queue/worker/infrastructure expansion
- broad design-system rewrite

## Root Cause Hypothesis

The current workspace is functionally rich but session-fragile for personal use:

1. preference storage exists, but the workspace is not using it to persist personal working context
2. the app restores server-backed conversations and histories, but not unsent work-in-progress
3. the current bootstrap path restores the first available conversation instead of the last intentional one
4. the UI gives no strong signal that recent work is being preserved or intentionally discarded

## Recommended Approach

Use the existing `user_preferences.template_preferences_json` field as the durable workspace-resume envelope.

Why this approach:

- no schema migration is required
- the state is already account-scoped
- the data is small and user-specific
- it works with the existing `GET/POST /api/preferences` contract

Store:

- `workspace.lastTab`
- `workspace.lastConversationId`
- `workspace.drafts`
- `workspace.lastSavedAt`

## Execution Order

### Phase 1: State Contract And Planning

1. document the personal-usage polish target
2. define a bounded workspace resume-state schema
3. identify all input sources that should participate in draft autosave

Acceptance:

- the new scope is documented in `docs/dev`
- persistence boundaries are explicit before code edits begin

### Phase 2: Workspace Resume Persistence

1. add client helpers to read/write workspace state from preferences JSON
2. persist:
  - last active tab
  - last active conversation
  - draft data per feature
3. restore saved state during authenticated workspace bootstrap

Acceptance:

- reload keeps the user near the same working context
- conversation restore prefers the last intentional conversation when valid
- drafts come back after reload for the supported features

### Phase 3: Intentional UX Layer

1. add a compact workspace resume/status card to the main workspace
2. surface autosave/discard state in a way that feels deliberate, not accidental
3. wire existing reset buttons to clear both visible fields and saved drafts

Acceptance:

- the user can tell the workspace is remembering recent work
- reset behaves like "discard draft", not only "clear DOM fields"

### Phase 4: Regression And Closeout

1. extend markup/state/browser coverage where needed
2. run focused regression first
3. run a broader release-safe regression after the polish slice is stable
4. update archive indexing if this round lands cleanly

Acceptance:

- new continuity behavior is covered by automated checks
- no auth/account/admin regression is introduced

## Risks To Watch

1. restoring stale conversation IDs after archive/delete
2. saving too aggressively and spamming the preferences endpoint
3. restoring drafts in a way that overwrites intentional server-backed state
4. adding new UI chrome that competes with the existing sidebar hierarchy

## Phase-End Review Requirement

After each phase, record:

- new problems found
- missed edge cases
- fixes or plan updates applied
