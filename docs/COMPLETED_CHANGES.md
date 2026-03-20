# Completed Changes

Check off items here as we implement planned changes. Copy the checklist from [PLANNED_CHANGES.md](./PLANNED_CHANGES.md) when starting a new plan.

---

## Initial Implementation (March 2025)

These items reflect the state of the product as of the first release.

- [x] Core automation: CSV parsing, row iteration, form fill, Save
- [x] Microsoft OAuth login (email + Next + MFA wait)
- [x] Checkpoint/resume via `progress.json`
- [x] Progress logging via `progress.log`
- [x] Error toast detection (`.MuiAlert-message`)
- [x] Retry logic (configurable `maxRetries`, default 2)
- [x] Graceful stop (Ctrl+C)
- [x] Playwright codegen-based selectors in `config.js`
- [x] CLI args: `--csv`, `--limit`
- [x] npm scripts: `start`, `test:sample`, `install:browsers`

---

## March 2025: Toast-Based Success/Failure Detection

- [x] Step 1: Add config for successToastRegExp and failureReasons
- [x] Step 2: Add getToastMessage() helper
- [x] Step 3: Add classifyToastResult() helper
- [x] Step 4: Add logUnrecognizedFailure() helper
- [x] Step 5: Refactor processRow() retry and result logic
- [x] Step 6: Update failure logging in main() and progress
- [x] Step 7: Add unrecognized-failures.log to .gitignore
- [x] Step 8: Update docs (PRD, GETTING_STARTED)
- [x] Step 9: Add checklist to COMPLETED_CHANGES.md

---

## March 2025: Poll for Form or Login Page Arrival

- [x] Step 1: Add arrivalCheckIntervalMs and arrivalCheckMaxAttempts to config
- [x] Step 2: Implement waitForFormOrLogin(page) returning form, login, or throwing
- [x] Step 3: Refactor doOneAttempt to use it; simplify maybeLogin
- [x] Step 4: Add config comments for timeout, networkIdleWait, postSaveWait
- [x] Step 5: Update PRD and COMPLETED_CHANGES

---

## Future Completed Changes

_Add checkmarks here as we complete items from PLANNED_CHANGES.md._
