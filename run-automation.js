#!/usr/bin/env node
/**
 * Playwright Browser Automation
 *
 * Reads rows from a CSV file and, for each row:
 * - Opens the app URL, logs in if needed
 * - Enters Load Record, Tab, Item Number, Enter
 * - Waits for page to finish loading/rerendering
 * - Makes a trivial change (price +1 cent, then back) to enable Save
 * - Clicks Save
 * - Waits 5 seconds and checks for error toast (.MuiAlert-message)
 * - Retries up to maxRetries (default 2) if Save fails
 * - Saves checkpoint after each row for resume support
 *
 * Press Ctrl+C to gracefully stop after the current row completes.
 *
 * Usage:
 *   npm start                    # Process all rows (resumes if progress.json exists)
 *   npm run test:sample          # Process first 5 rows only (ignores progress.json)
 *   node run-automation.js --csv rows-to-update-and-save.csv
 *   node run-automation.js --csv rows-to-update-and-save.csv --limit 10
 *
 * Resume: Leave progress.json in place to resume from last completed row.
 * Fresh start: Delete progress.json to begin from row 0.
 */

import { chromium } from 'playwright';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config.js';

// --- Parse CLI args ---
const args = process.argv.slice(2);
const csvIndex = args.indexOf('--csv');
const limitIndex = args.indexOf('--limit');
const csvPath = csvIndex >= 0 ? args[csvIndex + 1] : 'rows-to-update-and-save.csv';
const rowLimit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : null;

// --- Graceful stop ---
let stopAfterCurrentRow = false;
process.on('SIGINT', () => {
  console.log('\nCtrl+C received. Will finish current row, then stop.');
  stopAfterCurrentRow = true;
});

// --- Paths ---
const PROGRESS_JSON = resolve(process.cwd(), 'progress.json');
const PROGRESS_LOG = resolve(process.cwd(), 'progress.log');

function loadProgress() {
  if (!existsSync(PROGRESS_JSON)) return null;
  try {
    return JSON.parse(readFileSync(PROGRESS_JSON, 'utf-8'));
  } catch {
    return null;
  }
}

function saveProgress(data) {
  data.lastUpdated = new Date().toISOString();
  writeFileSync(PROGRESS_JSON, JSON.stringify(data, null, 2), 'utf-8');
}

function appendLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(PROGRESS_LOG, line, 'utf-8');
  console.log(msg);
}

// --- Load credentials ---
const credsPath = resolve(process.cwd(), 'credentials.json');
if (!existsSync(credsPath)) {
  console.error(
    '\nMissing credentials.json. Copy credentials.example.json to credentials.json and fill in your values.\n'
  );
  process.exit(1);
}
const credentials = JSON.parse(readFileSync(credsPath, 'utf-8'));

// --- Load CSV ---
const csvFullPath = resolve(process.cwd(), csvPath);
if (!existsSync(csvFullPath)) {
  console.error(`\nCSV file not found: ${csvFullPath}\n`);
  process.exit(1);
}

const csvText = readFileSync(csvFullPath, 'utf-8');
const allRows = parse(csvText, { columns: true, skip_empty_lines: true });

// --- Determine rows to process ---
let startIndex = 0;
let progress = rowLimit ? null : loadProgress();
if (progress && !rowLimit) {
  startIndex = progress.lastCompletedRowIndex + 1;
  console.log(
    `Resuming from row ${startIndex} (last completed: ${progress.lastCompletedRowIndex})`
  );
  if (progress.failedRows?.length) {
    console.log(`Previously failed rows: ${progress.failedRows.length}`);
  }
}

const endIndex = rowLimit ? Math.min(rowLimit, allRows.length) : allRows.length;
const rowsToProcess = allRows.slice(startIndex, endIndex);

if (rowsToProcess.length === 0) {
  console.log('No rows to process.');
  process.exit(0);
}

console.log(`Processing rows ${startIndex + 1}–${startIndex + rowsToProcess.length} from ${csvPath}`);

// --- Helpers ---
function loc(page, sel) {
  const s = Array.isArray(sel) ? sel[0] : sel;
  if (typeof s === 'string') return page.locator(s).first();
  if (s?.css) return page.locator(s.css).first();
  if (s?.role) return page.getByRole(s.role, s.name ? { name: s.name } : {}).first();
  return page.locator(s).first();
}

function getItemNumber(row) {
  return row['Item Number']?.trim() || row['Item Num']?.trim();
}

async function maybeLogin(page) {
  const emailInput = loc(page, config.selectors.emailInput);
  if (await emailInput.isVisible().catch(() => false)) {
    console.log('  Microsoft login detected. Entering email, then waiting for MFA on your phone...');
    await emailInput.fill(credentials.username);
    await loc(page, config.selectors.nextButton).click();

    // Wait for you to complete Authenticator (number + Yes + PIN) — up to mfaWaitTimeout
    const loadRecordField = loc(page, config.selectors.loadRecordInput);
    await loadRecordField.waitFor({
      state: 'visible',
      timeout: config.mfaWaitTimeout ?? 120000,
    });
    console.log('  MFA complete, on app.');
  }
}

async function hasErrorToast(page) {
  return loc(page, config.selectors.errorToast).isVisible().catch(() => false);
}

async function doOneAttempt(page, row, index) {
  const loadRecord = row['Load Record']?.trim();
  const itemNumber = getItemNumber(row);
  if (!loadRecord || !itemNumber) {
    throw new Error('Missing Load Record or Item Number');
  }

  // Ensure we're on the right page
  await page.goto(credentials.url, { waitUntil: 'domcontentloaded', timeout: config.timeout });
  await maybeLogin(page);

  // Enter Load Record
  const firstInput = loc(page, config.selectors.loadRecordInput);
  await firstInput.waitFor({ state: 'visible', timeout: config.timeout });
  await firstInput.fill(loadRecord);
  await firstInput.press('Tab');

  // Enter Item Number
  const itemInput = loc(page, config.selectors.itemNumInput);
  await itemInput.waitFor({ state: 'visible', timeout: config.timeout });
  await itemInput.fill(itemNumber);
  await itemInput.press('Enter');

  // Wait for page to finish rerendering
  await page.waitForLoadState('networkidle', { timeout: config.timeout }).catch(() => {});
  await new Promise((r) => setTimeout(r, config.networkIdleWait));

  // Make trivial change to Price
  const priceLoc = loc(page, config.selectors.priceField);
  if (await priceLoc.isVisible().catch(() => false)) {
    const currentPrice = await priceLoc.inputValue();
    const num = parseFloat(currentPrice.replace(/[^0-9.-]/g, '')) || 0;
    const newPrice = (num + 0.01).toFixed(2);
    await priceLoc.fill(newPrice);
    await priceLoc.fill(currentPrice);
  }

  // Save
  await loc(page, config.selectors.saveButton).click();
  await page.waitForLoadState('networkidle', { timeout: config.timeout }).catch(() => {});

  // Wait for error toast check
  await new Promise((r) => setTimeout(r, config.postSaveWait));
}

async function processRow(page, row, globalIndex) {
  const loadRecord = row['Load Record']?.trim();
  const itemNumber = getItemNumber(row);
  if (!loadRecord || !itemNumber) {
    appendLog(`Row ${globalIndex + 1}: SKIP (missing Load Record or Item Number)`);
    return { success: false, skipped: true };
  }

  const maxTries = config.maxRetries ?? 2;
  for (let tryNum = 1; tryNum <= maxTries; tryNum++) {
    try {
      await doOneAttempt(page, row, globalIndex);
      const hasError = await hasErrorToast(page);
      if (!hasError) {
        return { success: true };
      }
      if (tryNum < maxTries) {
        appendLog(
          `Row ${globalIndex + 1} (try ${tryNum}/${maxTries}): Error toast detected, retrying...`
        );
      }
    } catch (err) {
      if (tryNum < maxTries) {
        appendLog(`Row ${globalIndex + 1} (try ${tryNum}/${maxTries}): ${err.message}, retrying...`);
      } else {
        appendLog(`Row ${globalIndex + 1}: FAILED after ${maxTries} tries (${err.message})`);
        return { success: false, error: err.message };
      }
    }
  }

  return { success: false, exhausted: true };
}

// --- Main ---
async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const progressData = progress || {
    lastCompletedRowIndex: startIndex - 1,
    failedRows: [],
    lastUpdated: null,
  };

  try {
    for (let i = 0; i < rowsToProcess.length; i++) {
      if (stopAfterCurrentRow) {
        appendLog('Stopping after current row (Ctrl+C).');
        break;
      }

      const globalIndex = startIndex + i;
      const row = rowsToProcess[i];
      const result = await processRow(page, row, globalIndex);

      if (result.skipped) {
        progressData.lastCompletedRowIndex = globalIndex;
        saveProgress(progressData);
        continue;
      }

      if (result.success) {
        appendLog(`Row ${globalIndex + 1}: success (Load Record ${row['Load Record']}, Item ${getItemNumber(row)})`);
        progressData.lastCompletedRowIndex = globalIndex;
      } else {
        appendLog(
          `Row ${globalIndex + 1}: FAILED after 5 tries (Load Record ${row['Load Record']}, Item ${getItemNumber(row)})`
        );
        progressData.failedRows = progressData.failedRows || [];
        progressData.failedRows.push({
          rowIndex: globalIndex,
          loadRecord: row['Load Record'],
          itemNumber: getItemNumber(row),
          tries: maxTries,
        });
        progressData.lastCompletedRowIndex = globalIndex;
      }

      saveProgress(progressData);
    }
  } finally {
    await browser.close();
  }

  console.log('Done.');
  if (progressData.failedRows?.length) {
    console.log(`Failed rows (see progress.json): ${progressData.failedRows.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
