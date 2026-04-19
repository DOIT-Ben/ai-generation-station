# Music / Cover Regression Plan

## Goal

Close the remaining live regression failures in `test-regression.js` without touching the completed chat conversation chain work:

- `Music`: `Music generation failed`
- `Cover`: `Voice cover task polling timed out`

## Scope Guard

- Do not reopen chat conversation chain work.
- Keep commit `c917d6e` as the chat baseline.
- Only change code that is directly involved in the `Music` and `Cover` live task flows, or tests needed to lock the fixes in.

## Current Context

- The chat conversation chain work is already completed and documented in `2026-04-19-chat-conversation-chain-execution.md`.
- User-local regression on 2026-04-19 showed:
  - passed: `FrontendState`, `PageMarkup`, `AuthHistory`, `TaskPersistence`, `Smoke`, `Failures`, `Lyrics`, `Image`, `VoiceCover`
  - failed: `Music`, `Cover`
- `Music` uses `/api/generate/music` and polls `/api/music/status`.
- `Cover` uses `/api/generate/voice` and polls `/api/music-cover/status`.

## Suspected Risk Areas

### Music

- request payload shape does not match the upstream API expectation for the current prompt type
- initial response parsing is too narrow and rejects a valid async response shape
- result polling treats a valid provider status as failure

### Cover

- async start response shape differs from the current parser assumptions
- polling status mapping misses a valid provider state and never transitions to `completed`
- output download or persisted status payload is incomplete, causing the test to wait until timeout

## Execution Strategy

1. Reproduce each failure in isolation.
2. Compare actual provider response shapes with current route assumptions.
3. Form a minimal root-cause hypothesis for each path.
4. Apply the smallest safe fix in server task routes.
5. Re-run targeted live checks before considering broader regression.
6. Record each TODO closeout, including newly discovered edge cases and planning gaps.

## TODO

1. read current Music / Cover route and test flow, then create this round's execution log
2. reproduce and isolate `Music generation failed`
3. reproduce and isolate `Voice cover task polling timed out`
4. implement minimal route fixes and any necessary regression coverage
5. run targeted verification and update the execution log with closeout notes

## Verification Target

- `node test-music.js`
- `node test-cover.js`
- if both pass, re-run `node test-regression.js` or the smallest equivalent subset that proves the remaining live failures are gone

## Known Constraints

- The Codex shell environment previously showed a noisy Anaconda-related startup warning.
- If a failure only reproduces in the user's local shell, document that explicitly instead of guessing.
