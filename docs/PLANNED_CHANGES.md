# Planned Changes

Use this document to record the steps of a plan we agree on before implementation. Each item becomes a checklist entry in [COMPLETED_CHANGES.md](./COMPLETED_CHANGES.md).

**Conventions (avoid markdownlint MD024):**

- Use **ODBC-style dates** (e.g. `2026-03-20 7:39 PM`), not month/year. Run `date` to get the current timestamp when adding new plans.
- For recurring headings (Overview, Checklist, Step 1, etc.), append ` for [ODBC date]` to make each unique (e.g. `### Overview for 2026-03-20 7:39 PM`, `### Checklist for 2026-03-20 7:39 PM`).

---

## Template for New Plans

When we agree on a plan, add a section below with a date and checklist:

### [ODBC Date, e.g. 2026-03-20 7:33 PM] Plan: [Title]

- [ ] Step 1: ...
- [ ] Step 2: ...
- [ ] Step 3: ...

---

## 2026-03-15 2:00 PM Plan: Toast-Based Success/Failure Detection with Categorized Failures (IMPLEMENTED)

### Overview for 2026-03-15 2:00 PM

Replace the current binary "error toast visible = failure" logic with content-aware detection: use RegExps to distinguish success messages from failure messages, categorize failures by reason, control retries per category, and log unrecognized failures for future config expansion.

---

### Step 1 for 2026-03-15 2:00 PM: Add config for success and failure detection

**File:** `config.js`

Add:

- `successToastRegExp`: RegExp (or string that becomes RegExp). Default: `/successfully/i` — if the toast message matches, the Save succeeded.
- `failureReasons`: Array of failure-reason objects. Each object has:
  - `category` (string): e.g. `"missing or invalid required fields"`
  - `failureReasonRegExp`: RegExp (or string) that the message must match to qualify as this failure type
  - `failureDetailsRegExp`: RegExp with a capture group to extract details from the message (e.g. field names). Optional; if absent or no match, use full message or empty string.
  - `retryOnFail` (boolean): `true` = retry up to `maxRetries`; `false`/undefined/falsey = do not retry, move on immediately

Initial `failureReasons` entry:

```js
{
  category: "missing or invalid required fields",
  failureReasonRegExp: /^Please fix the following fields: /,
  failureDetailsRegExp: /^Please fix the following fields: (.+)$/,
  retryOnFail: false,
}
```

---

### Step 2 for 2026-03-15 2:00 PM: Add `getToastMessage()` helper

**File:** `run-automation.js`

Replace `hasErrorToast(page)` with `getToastMessage(page)` that:

- Returns the text content of the first visible `.MuiAlert-message` element (or equivalent from config).
- Returns `null` if no toast is visible.

---

### Step 3 for 2026-03-15 2:00 PM: Add `classifyToastResult(message)` helper

**File:** `run-automation.js`

Given a toast message string:

1. If `message` is null/empty → return `{ type: 'none' }` (no toast; treat as unknown for now).
2. If `message` matches `config.successToastRegExp` → return `{ type: 'success' }`.
3. Otherwise, iterate over `config.failureReasons`:
   - If `failureReasonRegExp` matches:
     - Use `failureDetailsRegExp` to extract details (first capture group, or full message).
     - Return `{ type: 'failure', category, details, retryOnFail }`.
4. If no failure reason matches → return `{ type: 'unknown', message }`.

---

### Step 4 for 2026-03-15 2:00 PM: Add `logUnrecognizedFailure()` helper

**File:** `run-automation.js`

- Appends to `unrecognized-failures.log` with: timestamp, row info (Load Record, Item Number), and the full message.
- Creates the file if it doesn’t exist.

---

### Step 5 for 2026-03-15 2:00 PM: Refactor `processRow()` retry and result logic

**File:** `run-automation.js`

- After `doOneAttempt()`, call `getToastMessage()` then `classifyToastResult(message)`.
- If `type === 'success'` → return `{ success: true }`.
- If `type === 'failure'`:
  - If `retryOnFail` is true and retries remain → log retry message, retry.
  - Else → log failure with category and details, return `{ success: false, category, details }`.
- If `type === 'unknown'`:
  - Call `logUnrecognizedFailure()`, then return `{ success: false, category: 'unrecognized', details: message }`. Do not retry (treat like `retryOnFail: false`).
- If `type === 'none'`:
  - Treat as unknown: log to `unrecognized-failures.log`, return failure, do not retry.

---

### Step 6 for 2026-03-15 2:00 PM: Update failure logging in `main()` and progress

**File:** `run-automation.js`

- When a row fails, `appendLog()` should include category and details, e.g.:
  - `Row 42: FAILED (missing or invalid required fields) Tag Size, Pieces, Material Grouping`
- `failedRows` entries in `progress.json` should include `category` and `details` (in addition to `loadRecord`, `itemNumber`, `tries`).

---

### Step 7 for 2026-03-15 2:00 PM: Add `unrecognized-failures.log` to `.gitignore`

**File:** `.gitignore`

Ensure `unrecognized-failures.log` is listed so it isn’t committed.

---

### Step 8 for 2026-03-15 2:00 PM: Update docs

**Files:** `docs/PRD.md`, `docs/GETTING_STARTED.md`

- Document `successToastRegExp`, `failureReasons`, and the structure of failure-reason objects.
- Document `unrecognized-failures.log` and how to use it to add new failure categories.

---

### Step 9 for 2026-03-15 2:00 PM: Add entry to `docs/COMPLETED_CHANGES.md`

- Copy this plan’s checklist into `COMPLETED_CHANGES.md` as unchecked items; check them off as each step is implemented.

---

## 2026-03-17 3:30 PM Plan: Poll for Form or Login Page Arrival (IMPLEMENTED)

### Overview for 2026-03-17 3:30 PM

Replace the URL-based check with element-based polling. After navigating, wait 2 seconds, then check if the form (Load Number / Item Number) or login page (email field) is visible. If neither, wait 2 more seconds and retry, up to 5 times. Exit with error if never arrived. Avoids check-too-soon and wait-10-sec-when-already-on-form issues.

### Checklist for 2026-03-17 3:30 PM

- [x] Step 1: Add arrivalCheckIntervalMs and arrivalCheckMaxAttempts to config
- [x] Step 2: Implement waitForFormOrLogin(page) returning form, login, or throwing
- [x] Step 3: Refactor doOneAttempt to use it; simplify maybeLogin
- [x] Step 4: Add config comments for timeout, networkIdleWait, postSaveWait
- [x] Step 5: Update PRD and COMPLETED_CHANGES

---

## 2026-03-20 7:33 PM Plan: Logs Folder + Toast Polling (IMPLEMENTED)

### Overview for 2026-03-20 7:33 PM

1. Move progress.json, progress.log, unrecognized-failures.log into logs/ subfolder
2. Poll for toast every 1s (first check at 1s) until postSaveWait; reduces false "no toast" when API is slow

### Checklist for 2026-03-20 7:33 PM

- [x] Step 1: Create logs dir, update paths, ensure dir exists, migrate old files
- [x] Step 2: Implement toast polling (Option B)
- [x] Step 3: Update .gitignore and docs
