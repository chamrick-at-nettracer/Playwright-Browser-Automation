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

## Future Completed Changes

_Add checkmarks here as we complete items from PLANNED_CHANGES.md._
