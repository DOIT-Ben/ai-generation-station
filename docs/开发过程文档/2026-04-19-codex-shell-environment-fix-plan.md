# Codex Shell Environment Fix Plan

## Goal

Repair the current Codex PowerShell session environment so live Node-based regression work can run reliably again.

## Observed Symptoms

- every shell command prints `Error while loading conda entry point: anaconda-auth ([WinError 10106] ...)`
- Node 22 crashes on script startup with `Assertion failed: ncrypto::CSPRNG(nullptr, 0)`
- Python can fail before startup with `failed to get random numbers to initialize Python`
- `Invoke-WebRequest` and `curl.exe` show network-stack failures in the current agent shell

## Initial Hypotheses

1. PowerShell startup is running `conda init`, and that startup path is failing in the Codex shell.
2. The Codex shell may be inheriting an incomplete Windows environment snapshot.
3. Missing base Windows env vars could break crypto initialization, Python startup, and parts of the networking stack before project code even runs.

## Execution Strategy

1. inspect the PowerShell profile and Conda hook path
2. inspect critical environment variables and compare against expected Windows defaults
3. verify whether restoring missing env vars fixes Node / Python / curl
4. apply the smallest durable fix in the PowerShell profile so future Codex shell invocations self-heal
5. verify with a fresh shell process, then resume project regression work

## TODO

1. document the environment failure and inspect current shell startup
2. isolate the root cause of the missing env / Conda startup failures
3. patch the PowerShell profile with safe env restoration
4. validate Node 22, Python, curl, and Conda in a fresh shell
5. write closeout notes and return to the project regression mainline
