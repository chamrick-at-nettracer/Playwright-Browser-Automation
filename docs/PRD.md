# Product Requirements Document

## Playwright Browser Automation

**Version:** 1.0
**Last updated:** March 2025

---

## 1. Overview

This product automates a browser to process items from a CSV file. For each row, it navigates to a web application, looks up an item by Load Record and Item Number, makes a trivial change to enable saving, and clicks Save. The automation supports resume/checkpoint, retry on failure, and graceful interruption.

**Target application:** OPS App at `https://ops-ub.reunitus.com/item/add` (or similar item-management interfaces).

---

## 2. Goals

- Process ~25,000 rows from a CSV file with minimal manual intervention
- Handle Microsoft OAuth login with MFA (Authenticator app)
- Recover from transient Save failures via retries
- Support pause/resume across sessions
- Allow clean interruption at end of current row

---

## 3. Functional Requirements

### 3.1 CSV Input

- **Required columns:** `Load Record`, `Item Number`
- **Source:** `rows-to-update-and-save.csv` (default) or user-specified via `--csv`
- **Format:** Standard CSV with comma delimiter, first row as headers
- **Note:** All items in the CSV are assumed to exist in the database

### 3.2 Authentication

- **Provider:** Microsoft OAuth (login.microsoftonline.com)
- **Flow:** Email → Next → **MFA on phone** (Authenticator app)
- **Credentials:** Email only (username); no password used
- **MFA:** User completes manually (number + Yes + PIN); script waits until app loads
- **Session:** One MFA per session; subsequent rows use same authenticated session
- **Credentials storage:** `credentials.json` (gitignored)

### 3.3 Per-Row Workflow

For each row:

1. Navigate to app URL
2. Detect and complete login if presented (email, Next, wait for MFA, then continue)
3. Enter **Load Record** in Load Number field, press Tab
4. Enter **Item Number** in Item Number field, press Enter
5. Wait for page to finish loading/rerendering (network idle + buffer)
6. Make trivial change to **Price** field: add $0.01, then restore original value
7. Click **Save**
8. Wait 5 seconds
9. Check for error toast (`.MuiAlert-message`)
10. If error: retry row (up to `maxRetries` times, default 2)
11. If success or max retries exhausted: record outcome and continue to next row
12. Save checkpoint to `progress.json`, append to `progress.log`

### 3.4 Error Handling

- **Error detection:** Presence of `.MuiAlert-message` in DOM indicates Save failed
- **Retries:** Configurable `maxRetries` (default 2) per row before skipping
- **Failed rows:** Recorded in `progress.json` with row index, Load Record, Item Number, and try count
- **Validation failures:** Some items may have incomplete or invalid data; Save fails → retry → skip after max tries

### 3.5 Checkpoint and Resume

- **progress.json:** Machine-readable checkpoint
  - `lastCompletedRowIndex` – last row processed (success or skip)
  - `failedRows` – list of rows that exhausted retries
  - `lastUpdated` – timestamp
- **progress.log:** Human-readable log of each row outcome
- **Resume:** If `progress.json` exists, start from `lastCompletedRowIndex + 1`
- **Fresh start:** Delete `progress.json` to begin from row 0
- **Files:** Both in `.gitignore`

### 3.6 Graceful Interruption

- **Trigger:** Ctrl+C (SIGINT)
- **Behavior:** Set `stopAfterCurrentRow`; finish current row (including retries if failing); do not start next row; exit
- **Checkpoint:** Saved before exit

---

## 4. Non-Functional Requirements

- **Node.js:** 18+
- **Browser:** Chromium (Playwright)
- **Headed vs headless:** Default headed; configurable in code for long runs
- **Performance:** Sequential processing; one row at a time
- **Timeout:** 30s for most operations; 2 minutes for MFA wait

---

## 5. Technical Specifications

### 5.1 Architecture

- **Runtime:** Node.js ES modules
- **Automation:** Playwright (used as library, not test runner)
- **CSV parsing:** `csv-parse`
- **Entry point:** `run-automation.js`

### 5.2 File Structure

```text
├── run-automation.js           # Main script
├── config.js                  # Selectors, timeouts, retries
├── credentials.example.json
├── credentials.json           # Gitignored
├── sample-data.csv            # Test data (5 rows)
├── rows-to-update-and-save.csv # Full data (~25k rows)
├── progress.json              # Gitignored checkpoint
├── progress.log               # Gitignored log
├── README.md
├── docs/
│   ├── GETTING_STARTED.md     # Setup and usage guide
│   ├── PRD.md                 # This document
│   ├── PLANNED_CHANGES.md     # Agreed change backlog
│   └── COMPLETED_CHANGES.md   # Implementation checklist
└── package.json
```

### 5.3 Selector Format

Config supports two formats:

- **Role-based:** `{ role: 'textbox', name: 'Load Number' }` → `page.getByRole(...)`
- **CSS:** `{ css: '.MuiAlert-message' }` → `page.locator(...)`

### 5.4 Config Options

| Option | Default | Description |
| ------ | ------- | ----------- |
| `timeout` | 30000 | General action timeout (ms) |
| `networkIdleWait` | 2000 | Extra wait after network idle (ms) |
| `postSaveWait` | 5000 | Wait before error toast check (ms) |
| `mfaWaitTimeout` | 120000 | Max wait for MFA completion (ms) |
| `maxRetries` | 2 | Retries per row when Save fails |

### 5.5 CLI Arguments

| Argument | Description |
| -------- | ----------- |
| `--csv &lt;path&gt;` | CSV file path (default: rows-to-update-and-save.csv) |
| `--limit &lt;n&gt;` | Process only first n rows; ignores progress.json |

### 5.6 npm Scripts

| Script | Command | Description |
| ------ | ------- | ----------- |
| `npm start` | `node run-automation.js` | Full run (resumes if progress exists) |
| `npm run test:sample` | `node run-automation.js --csv sample-data.csv --limit 5` | Test with 5 rows |
| `npm run install:browsers` | `npx playwright install chromium` | Install Chromium |

---

## 6. Assumptions

- CSV contains only items that exist in the database
- Error toast uses `.MuiAlert-message` class (MUI)
- Price field can be edited to trigger dirty state for Save
- Microsoft OAuth redirects to app after successful MFA
- Session persists for duration of run (no mid-session re-auth)

---

## 7. Out of Scope (Current)

- Parallel processing of rows
- Automatic handling of "item not found"
- Configurable CSV delimiter/encoding
- Alternative authentication flows
- Headless-by-default operation
