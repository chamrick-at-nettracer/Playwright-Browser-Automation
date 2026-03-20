# Getting Started with Playwright Browser Automation

This guide walks you through setting up and running the automation that processes rows from a CSV file.

---

## Prerequisites

- **Node.js** 18+ installed ([nodejs.org](https://nodejs.org))
- Your app’s URL and login credentials (username/password)

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
     "url": "https://your-actual-app.example.com/items",
     "username": "your-username",
     "password": "your-password"
   }
   ```

`credentials.json` is in `.gitignore`, so it will not be committed.

---

## Step 4: Prepare Your CSV File

Your CSV must have columns **`Load Record`** and **`Item Num`**. Example:

```csv
Load Record,Item Num
LR-001,1001
LR-002,1002
```

Use `sample-data.csv` for initial testing, or create your own file (e.g. `my-data.csv`).

---

## Step 5: Customize Selectors

The automation needs to know which HTML elements to interact with. Edit **`config.js`** and set the selectors to match your app.

To find selectors:

1. Open your app in a browser.
2. Right‑click the element (e.g. the Load Record input) → **Inspect**.
3. In DevTools, use the element’s attributes to build a selector:
   - `input[name="loadRecord"]` if it has `name="loadRecord"`
   - `input#loadRecord` if it has `id="loadRecord"`
   - Or use Playwright’s role/locator suggestions in the Playwright Inspector.

Update each selector in `config.js` to match your app.

---

## Step 6: Test With a Few Rows First

Process only the first few rows to verify everything works:

```bash
npm run test:sample
```

This runs with 5 rows. You can change the limit:

```bash
node run-automation.js --limit 10
```

---

## Step 7: Run the Full Automation

When you’re confident the script works:

```bash
npm start
```

To use a specific CSV file:

```bash
node run-automation.js --csv my-data.csv
```

To limit rows (useful for debugging):

```bash
node run-automation.js --csv my-data.csv --limit 100
```

---

## How It Works

For each row in the CSV, the script:

1. Opens your app URL
2. Logs in if a login form is present
3. Enters **Load Record** in the first field and presses Tab
4. Enters **Item Num** in the next field and presses Enter
5. Waits for the page to finish loading (network idle + short buffer)
6. Makes a trivial change to the Price field (+$0.01, then restores the original)
7. Clicks **Save**

By default, the browser runs in **headed** mode (you see it). To run in the background, change `headless: false` to `headless: true` in `run-automation.js`.

---

## Handling ~25,000 Rows

For large runs:

- Consider `headless: true` to reduce resource use.
- Add retries or error handling for flaky network or page issues.
- Optionally add checkpoints: log progress and support resuming from a given row.
- Run during off‑peak hours.

---

## Troubleshooting

| Problem | What to check |
|--------|---------------|
| "Missing credentials.json" | Copy `credentials.example.json` to `credentials.json` and fill in values |
| "CSV file not found" | Ensure the file path is correct; use `--csv path/to/file.csv` |
| Elements not found / wrong fields | Inspect your app and update selectors in `config.js` |
| Login fails | Check `usernameInput`, `passwordInput`, `loginButton` in `config.js` |
| Save doesn’t work | Verify `saveButton` and `priceField` selectors |
| Page rerenders too fast/slow | Adjust `networkIdleWait` in `config.js` |

---

## Next Steps

1. Run `npm install` and `npm run install:browsers`
2. Create `credentials.json` from the example
3. Test with `npm run test:sample`
4. Adjust selectors in `config.js` as needed
5. Run the full automation with your real CSV
