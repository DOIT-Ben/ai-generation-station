# Voice Cover Empty Output Plan

## Goal

Fix the `voice-cover` output materialization bug where the task completes successfully but the saved local mp3 file is `0` bytes.

## Current Context

- `test-regression.js` is already green after the environment and Music/Cover regression fixes.
- A new independent defect remains:
  - completed `cover_*.mp3` files are persisted as empty files
- Recent task history shows:
  - task status is `completed`
  - returned local URL is present
  - recorded `size` is `0`

## Suspected Root Cause

- the provider may be returning an audio download URL in a field that the current route interprets as hex audio
- the current route may mark the task complete without validating that the materialized file is non-empty

## Execution Strategy

1. confirm the exact provider response shape for successful `music-cover`
2. fix output materialization with the smallest safe parser change
3. enforce non-empty output validation before marking the task complete
4. extend regression coverage so this defect is caught without relying only on live checks

## TODO

1. inspect the live provider response shape and create this round's execution log
2. implement the minimal route fix for URL-vs-hex audio handling
3. add route-level regression coverage and strengthen live assertions
4. run targeted verification and write closeout notes
