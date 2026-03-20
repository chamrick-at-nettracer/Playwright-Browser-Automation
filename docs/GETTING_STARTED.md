# Getting Started with Playwright Browser Automation

This guide walks you through setting up and running the automation that processes rows from a CSV file.

---

## Prerequisites

- **Node.js** 18+ installed ([nodejs.org](https://nodejs.org))
- Your app’s URL and Microsoft account email (login uses MFA via Authenticator app)

---

## Step 1: Install Dependencies

From the project root:

```bash
npm install
```

This installs Playwright and `csv-parse` for reading the CSV file.

---

## Step 2: Install Browsers (Playwright)

Playwright needs browser binaries before it can run:

```bash
npm run install:browsers
```

This installs Chromium. You can also run `npx playwright install` to install all browsers (Chromium, Firefox, WebKit).

---

## Step 3: Set Up Credentials

1. Copy the example credentials file:

   ```bash
   cp credentials.example.json credentials.json
   ```

2. Edit `credentials.json` and add your real values:

   ```json
   {
     "url": "https://ops-ub.reunitus.com/item/add",
     "username": "your-email@company.com",
     "password": "unused-with-mfa"
   }
   ```

   For this app, login uses **Microsoft Authenticator** (MFA). The script enters your email and clicks Next, then waits up to 2 minutes for you to complete the Authenticator prompt on your phone. `password` is not used.

`credentials.json` is in `.gitignore`, so it will not be committed.

---

## Step 4: Prepare Your CSV File

Your CSV must have columns **`Load Record`** and **`Item Number`**. Example:

```csv
Load Record,Item Number
LR-001,1001
LR-002,1002
```

Use `sample-data.csv` for initial testing. The full data file is `rows-to-update-and-save.csv`.

---

## Step 5: Customize Selectors (if needed)

The automation uses selectors defined in **`config.js`**. These are pre-configured for the OPS App from Playwright codegen.

**To find or update selectors** (e.g. if the app changes):

1. Run: `npx playwright codegen https://ops-ub.reunitus.com/item/add`
2. Complete the flow (login, lookup item, edit Price, Save).
3. Copy the generated locators from the Inspector and update `config.js`.
4. Use `{ role: 'textbox', name: 'X' }` for role-based locators, or `{ css: 'selector' }` for CSS.

The Price field uses an MUI-generated ID that may change; re-run codegen if it breaks.

**To add new failure categories:** Check `unrecognized-failures.log` for toast messages that weren't recognized. Add a new entry to `config.failureReasons` with `category`, `failureReasonRegExp`, `failureDetailsRegExp` (with a capture group for details), and `retryOnFail` (true/false).

---

## Step 6: Test With a Few Rows First

Process only the first few rows to verify everything works:

```bash
npm run test:sample
```

This processes 5 rows from `sample-data.csv` (ignores `progress.json`). You can change the limit:

```bash
node run-automation.js --csv rows-to-update-and-save.csv --limit 10
```

---

## Step 7: Run the Full Automation

When you’re confident the script works:

```bash
npm start
```

By default this uses `rows-to-update-and-save.csv`. To use a different CSV:

```bash
node run-automation.js --csv my-data.csv
```

To limit rows (useful for debugging):

```bash
node run-automation.js --csv rows-to-update-and-save.csv --limit 100
```

**Resume:** If `progress.json` exists, the script resumes from the last completed row. Delete `progress.json` to start from row 0.

**Graceful stop:** Press **Ctrl+C** to request a stop. The current row will complete (including retries), then the script exits.

---

## How It Works

For each row in the CSV, the script:

1. Opens your app URL
2. Polls every 2 seconds (up to 5 times) for form or login; if login, logs in; if neither after 5 attempts, exits with error
3. Enters **Load Record** in the first field and presses Tab
4. Enters **Item Number** in the next field and presses Enter
5. Waits for the page to finish loading (network idle + short buffer)
6. Makes a trivial change to the Price field (+$0.01, then restores the original)
7. Clicks **Save**
8. Waits 5 seconds and reads the toast message (`.MuiAlert-message`)
9. **Success:** If message contains "successfully" (or matches `successToastRegExp`) → record success
10. **Failure:** If message does not match success, classifies by `failureReasons` in config:
    - **Recognized:** Logs category and details; retries only if `retryOnFail` is true
    - **Unrecognized:** Appends to `unrecognized-failures.log` for later review; no retry
11. Saves progress to `progress.json` and appends to `progress.log`

By default, the browser runs in **headed** mode (you see it). To run in the background, change `headless: false` to `headless: true` in `run-automation.js`.

---

## Resume and Progress

- **progress.json** – Checkpoint for resuming. Contains `lastCompletedRowIndex` and `failedRows` (with category and details).
- **progress.log** – Human-readable log of each row's outcome (success or failure with reason).
- **unrecognized-failures.log** – Toast messages that didn't match any known failure reason. Review to add new `failureReasons` entries to `config.js`.
- **Resume:** Leave `progress.json` in place to pick up where you left off.
- **Fresh start:** Delete `progress.json` to begin from row 0.
- **Graceful stop:** Press **Ctrl+C**. The current row completes (with retries if needed), then the script exits.

---

## Handling ~25,000 Rows

- Consider `headless: true` to reduce resource use.
- Run during off‑peak hours.
- Use Ctrl+C to pause; resume later by running `npm start` again (with `progress.json` intact).

---

## Troubleshooting

| Problem | What to check |
| ------- | ------------- |
| "Missing credentials.json" | Copy `credentials.example.json` to `credentials.json` and fill in values |
| "CSV file not found" | Ensure the file path is correct; use `--csv path/to/file.csv` |
| Elements not found / wrong fields | Inspect your app and update selectors in `config.js` |
| Login / MFA fails | Check `emailInput`, `nextButton` in `config.js`; ensure MFA completes within `mfaWaitTimeout` |
| Save doesn’t work | Verify `saveButton` and `priceField` selectors |
| Page rerenders too fast/slow | Adjust `networkIdleWait` in `config.js` |
| Wrong failure category | Add or adjust `failureReasons` in `config.js`; check `unrecognized-failures.log` |

---

## Next Steps

1. Run `npm install` and `npm run install:browsers`
2. Create `credentials.json` from the example
3. Test with `npm run test:sample`
4. Adjust selectors in `config.js` as needed
5. Run the full automation with your real CSV
