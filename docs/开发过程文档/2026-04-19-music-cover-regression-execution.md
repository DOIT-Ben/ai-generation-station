# Music / Cover Regression Execution Log

## Mainline

- Resume from chat conversation chain checkpoint `c917d6e`.
- Exclude chat conversation chain from this round.
- New single mainline: fix the two remaining live regressions in `test-regression.js`.

## TODO Progress

### TODO 1. Read current Music / Cover route and test flow, then create this round's execution log

- Status: completed
- Work:
  - read `docs/开发过程文档/2026-04-19-chat-conversation-chain-execution.md`
  - confirmed only `Music` and `Cover` remain open in `test-regression.js`
  - read `test-regression.js`, `test-music.js`, `test-cover.js`, `test-live-utils.js`
  - read `server/routes/tasks/music.js` and `server/routes/tasks/voice-cover.js`
- New issues found:
  - `Music` and `Cover` are both live provider flows, but they do not share exactly the same response parsing logic
  - `Cover` route path is implemented in `voice-cover.js`, not `cover.js`
- Boundary conditions handled:
  - excluded chat conversation chain work up front and treated `c917d6e` as the stable baseline
  - pulled local SQLite task records into the investigation path so live failures could still be analyzed when the current agent shell could not run Node 22 live scripts
- Missed earlier:
  - the previous handoff correctly isolated the feature boundary, but it did not preserve enough provider-response evidence for the next debug round

### TODO 2. Reproduce and isolate `Music generation failed`

- Status: completed
- Work:
  - queried `data/app-state.sqlite` for recent `music` tasks
  - confirmed the same lo-fi test input had both a historical success and a later immediate failure
  - verified the failing run stopped at `progress = 10` after about `314ms`, which means the error happened on the initial provider response before polling began
  - added tolerant parsing in `server/routes/tasks/music.js` for:
    - `audio_url` direct success payloads
    - nested `data.task_id` async payloads
    - broader pending/completed status values
    - provider error message propagation instead of collapsing everything to `Music generation failed`
  - added `test-music-route.js` to lock the two new response-shape regressions
- New issues found:
  - the initial music route only accepted `response.data.audio` or top-level `response.task_id`
  - any valid provider reply outside those two shapes was silently flattened into the generic `Music generation failed`
- Boundary conditions handled:
  - direct-download success via `audio_url` now completes the task
  - async task IDs nested under `data.task_id` now enter the existing polling flow
  - completed responses without any materialized audio now fail with a specific diagnostic instead of hanging behind a generic message
- Missed earlier:
  - the route assumed the provider response shape was stable, but task history shows the same prompt can return different accepted shapes on different runs

### TODO 3. Reproduce and isolate `Voice cover task polling timed out`

- Status: completed
- Work:
  - queried recent `cover` tasks from `data/app-state.sqlite`
  - matched the two latest live cover runs to the exact prompts used by `test-cover.js` and `test-voice-cover.js`
  - verified:
    - `Pop style` completed in about `108449ms`
    - `Magnetic male pop vocal` completed in about `85149ms`
  - compared those durations with the test-side timeout window:
    - `test-cover.js` originally allowed `30 * 3000ms = 90000ms`
    - frontend cover polling already allows `60 * 2000ms = 120000ms`
  - updated `test-cover.js` to use shared `pollTaskStatus()` with a `150000ms` budget
  - raised `test-voice-cover.js` default polling budget to the same ceiling to reduce future flakiness
- New issues found:
  - the failing `Cover` item was not a server-side crash; the task really did complete, but its observed provider latency exceeded the test's 90-second budget
  - recent completed cover tasks produced `size: 0` output files, which is a separate correctness issue from the timeout
- Boundary conditions handled:
  - aligned live test polling with the slower but already accepted frontend behavior instead of leaving the regression suite stricter than the product itself
  - kept the cover route unchanged for this round because the recorded failure in `test-regression.js` was the timeout budget, not task-state parsing
- Missed earlier:
  - the previous regression design duplicated two very similar cover live tests but gave them a timeout budget that did not match real observed provider latency

### TODO 4. Implement minimal route fixes and any necessary regression coverage

- Status: completed
- Work:
  - updated `server/routes/tasks/music.js`
  - added `test-music-route.js`
  - wired `test-music-route.js` into `test-regression.js`
  - updated `test-cover.js` and `test-voice-cover.js` polling ceilings
- New issues found:
  - the current Codex shell still cannot execute the project's Node 22 live tests directly, so route-level regression coverage had to be added in a Node 18-compatible slice
- Boundary conditions handled:
  - kept the fix minimal and confined to music response parsing plus live test polling thresholds
  - avoided reopening the chat chain or unrelated task routes
- Missed earlier:
  - the old regression suite had no fast non-live test around music response-shape drift, so a provider envelope change could only be caught by costly live runs

### TODO 5. Run targeted verification and update the execution log with closeout notes

- Status: completed
- Verification completed:
  - syntax check passed in fallback Node 18 for:
    - `server/routes/tasks/music.js`
    - `test-cover.js`
    - `test-voice-cover.js`
    - `test-regression.js`
  - passed in fallback Node 18:
    - `node test-music-route.js`
  - after repairing the Codex shell environment:
    - `node test-regression.js` passed with `12/12` groups green
    - `Music` passed
    - `Cover` passed
    - `VoiceCover` passed
- New issues found:
  - even in the passing live regression run, the generated `cover_*.mp3` files were still `0` bytes on disk
- Boundary conditions handled:
  - closed the original `Music` / timeout regression mainline without mixing it with the new output-materialization defect
- Missed earlier:
  - the regression suite validates task completion and URL return, but it does not currently assert that completed cover outputs are non-empty files

## Working Notes

### Music observations

- accepts direct `response.data.audio` as an immediate success path
- previously only accepted top-level `response.task_id` as an async path
- previously only treated `response.status === 2` as success, `0/1` as pending, and everything else as failure
- now also accepts:
  - `response.data.audio_url`
  - `response.audio_url`
  - `response.data.task_id`
  - string pending/completed statuses
  - provider error messages from `base_resp` / `error` / `message`

### Cover observations

- sends `model: 'music-cover'` to the same `/v1/music_generation` upstream family
- initial request treats `base_resp.status_code !== 0` as failure
- async success depends on `response.task_id`
- polling treats `0/1/'pending'/'processing'` as pending and `2 + audio/audio_url` as success
- the recorded timeout was caused by test budget mismatch, not by a task-state parser crash
- completed cover files in both the earlier runs and the final passing regression run were persisted with `size: 0`

## Open Questions

1. Does the provider now return a different success / pending status shape for music or cover tasks?
2. Does one route accept a response shape that the other route rejects?
3. Is the `Cover` timeout caused by a status-mapping bug, or by missing output materialization after the provider says success?

## Current Answer

1. For `Music`, yes: task history plus route behavior showed the code was too narrow for provider response-shape drift, so the route now accepts more valid success / pending envelopes and preserves upstream error text.
2. For `Cover`, the timeout item in `test-regression.js` was caused by the test budget being lower than real observed provider completion time.
3. A separate cover output bug remains: recent completed tasks, including the final passing regression run, still wrote `0`-byte files. That issue was documented but not expanded into this mainline because it is not the reason the current regression suite failed.

## Final Status

- Original mainline status: closed
- Final verification:
  - `test-regression.js` passed in the repaired Codex environment
- Next recommended mainline:
  - investigate `voice-cover` output download / persistence because successful tasks still leave empty local mp3 files
