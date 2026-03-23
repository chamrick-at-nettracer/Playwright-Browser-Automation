#!/usr/bin/env node
/**
 * Playwright Browser Automation
 *
 * Reads rows from a CSV file and, for each row:
 * - Opens the app URL, logs in if needed
 * - Enters Load Record, Tab, Item Number, Enter
 * - Waits for page to finish loading/rerendering
 * - If Condition field exists and is empty → short-circuit: skip Save, treat as "condition not selected" failure
 * - Otherwise: makes trivial change (price +1 cent, then back) to enable Save, clicks Save
 * - Reads toast message; success = matches successToastRegExp, failure = categorized by failureReasons
 * - Retries only when retryOnFail is true; unrecognized failures go to logs/unrecognized-failures.log
 * - Saves checkpoint after each row for resume support
 *
 * Press Ctrl+C to gracefully stop after the current row completes.
 *
 * Usage:
 *   npm start                    # Process all rows (resumes if logs/progress.json exists)
 *   npm run test:sample          # Process first 5 rows only (ignores logs/progress.json)
 *   node run-automation.js --csv rows-to-update-and-save.csv
 *   node run-automation.js --csv rows-to-update-and-save.csv --limit 10
 *
 * Resume: Leave logs/progress.json in place to resume from last completed row.
 * Fresh start: Delete logs/progress.json to begin from row 0.
 */

import { chromium } from 'playwright';
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve } from 'path';
import { config } from './config.js';

const LOGS_DIR = resolve(process.cwd(), 'logs');

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
const PROGRESS_JSON = resolve(LOGS_DIR, 'progress.json');
const PROGRESS_LOG = resolve(LOGS_DIR, 'progress.log');
const UNRECOGNIZED_FAILURES_LOG = resolve(LOGS_DIR, 'unrecognized-failures.log');

function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });

  // One-time migration: copy old root-level log files into logs/ if they exist
  const oldProgress = resolve(process.cwd(), 'progress.json');
  const oldLog = resolve(process.cwd(), 'progress.log');
  const oldUnrec = resolve(process.cwd(), 'unrecognized-failures.log');
  if (existsSync(oldProgress) && !existsSync(PROGRESS_JSON)) copyFileSync(oldProgress, PROGRESS_JSON);
  if (existsSync(oldLog) && !existsSync(PROGRESS_LOG)) copyFileSync(oldLog, PROGRESS_LOG);
  if (existsSync(oldUnrec) && !existsSync(UNRECOGNIZED_FAILURES_LOG)) copyFileSync(oldUnrec, UNRECOGNIZED_FAILURES_LOG);
}

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
ensureLogsDir(); // Create logs/, migrate old root-level files if needed
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

/**
 * Poll until we detect either the app form or the login page.
 * Returns 'form' or 'login'. Throws if neither appears after max attempts.
 */
async function waitForFormOrLogin(page) {
  const interval = config.arrivalCheckIntervalMs ?? 2000;
  const maxAttempts = config.arrivalCheckMaxAttempts ?? 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, interval));

    const loadNumberField = loc(page, config.selectors.loadRecordInput);
    if (await loadNumberField.isVisible().catch(() => false)) {
      return 'form';
    }

    const emailSelectors = Array.isArray(config.selectors.emailInput)
      ? config.selectors.emailInput
      : [config.selectors.emailInput];
    for (const sel of emailSelectors) {
      const el = loc(page, sel);
      if (await el.isVisible().catch(() => false)) {
        return 'login';
      }
    }
  }

  throw new Error("Couldn't pull up either form or login page; exiting.");
}

/**
 * Assumes we're on the Microsoft login page. Fills email, clicks Next, waits for MFA.
 */
async function maybeLogin(page) {
  const emailSelectors = Array.isArray(config.selectors.emailInput)
    ? config.selectors.emailInput
    : [config.selectors.emailInput];
  let emailInput = null;
  for (const sel of emailSelectors) {
    const el = loc(page, sel);
    if (await el.isVisible().catch(() => false)) {
      emailInput = el;
      break;
    }
  }
  if (!emailInput) {
    await loc(page, emailSelectors[0]).waitFor({ state: 'visible', timeout: 15000 });
    emailInput = loc(page, emailSelectors[0]);
  }
  if (emailInput) {
    console.log('  Microsoft login detected. Entering email, then waiting for MFA on your phone...');
    await emailInput.click();
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

async function getToastMessage(page) {
  const toast = loc(page, config.selectors.errorToast);
  if (!(await toast.isVisible().catch(() => false))) return null;
  return toast.textContent().catch(() => null);
}

function classifyToastResult(message) {
  if (message == null || String(message).trim() === '') {
    return { type: 'none' };
  }
  const str = String(message).trim();
  const successRegex = config.successToastRegExp ?? /successfully/i;
  if (successRegex.test(str)) {
    return { type: 'success' };
  }
  const reasons = config.failureReasons ?? [];
  for (const r of reasons) {
    const reasonRegex = r.failureReasonRegExp instanceof RegExp
      ? r.failureReasonRegExp
      : new RegExp(r.failureReasonRegExp);
    if (reasonRegex.test(str)) {
      let details = '';
      if (r.failureDetailsRegExp) {
        const detailsRegex = r.failureDetailsRegExp instanceof RegExp
          ? r.failureDetailsRegExp
          : new RegExp(r.failureDetailsRegExp);
        const m = str.match(detailsRegex);
        if (m && m[1]) details = m[1].trim();
      }
      return {
        type: 'failure',
        category: r.category,
        details,
        retryOnFail: !!r.retryOnFail,
      };
    }
  }
  return { type: 'unknown', message: str };
}

function logUnrecognizedFailure(row, globalIndex, message) {
  const line = `[${new Date().toISOString()}] Row ${globalIndex + 1} (Load Record ${row['Load Record']}, Item ${getItemNumber(row)}): ${message}\n`;
  appendFileSync(UNRECOGNIZED_FAILURES_LOG, line, 'utf-8');
}

/**
 * Check if Condition field exists and is empty. Used to short-circuit Save when we know it will fail.
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean|null>} true = empty (short-circuit), false = filled, null = field not found
 */
async function isConditionEmpty(page) {
  const cfg = config.conditionField;
  if (!cfg?.selector) return null;

  const condLoc = loc(page, cfg.selector);
  if (!(await condLoc.isVisible().catch(() => false))) return null;

  const value = await condLoc.inputValue().catch(() => null);
  if (value == null) return null;
  return !value.trim();
}

async function doOneAttempt(page, row, index) {
  const loadRecord = row['Load Record']?.trim();
  const itemNumber = getItemNumber(row);
  if (!loadRecord || !itemNumber) {
    throw new Error('Missing Load Record or Item Number');
  }

  // Navigate, then poll until we arrive at form or login
  await page.goto(credentials.url, { waitUntil: 'load', timeout: config.timeout });
  const arrival = await waitForFormOrLogin(page);
  if (arrival === 'login') {
    await maybeLogin(page);
  }

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

  // Short-circuit: if Condition field exists and is empty, skip Save
  const empty = await isConditionEmpty(page);
  if (empty === true) {
    return {
      shortCircuited: true,
      result: {
        type: 'failure',
        category: 'condition not selected',
        details: '',
        retryOnFail: false,
      },
    };
  }

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

  // Poll for toast every 1s (first check at 1s) until postSaveWait — API can be slow
  const postSaveMs = config.postSaveWait ?? 10000;
  const pollIntervalMs = 1000;
  let elapsed = 0;
  while (elapsed < postSaveMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    elapsed += pollIntervalMs;
    const toast = loc(page, config.selectors.errorToast);
    if (await toast.isVisible().catch(() => false)) break;
  }
}

async function processRow(page, row, globalIndex) {
  const loadRecord = row['Load Record']?.trim();
  const itemNumber = getItemNumber(row);
  if (!loadRecord || !itemNumber) {
    appendLog(`Row ${globalIndex + 1}: SKIP (missing Load Record or Item Number)`);
    return { success: false, skipped: true };
  }

  const maxTries = config.maxRetries ?? 2;
  let tryNum = 0;

  while (true) {
    tryNum++;
    try {
      const doResult = await doOneAttempt(page, row, globalIndex);
      let result;
      if (doResult?.shortCircuited && doResult.result) {
        result = doResult.result;
      } else {
        const message = await getToastMessage(page);
        result = classifyToastResult(message);
      }

      if (result.type === 'success') {
        return { success: true };
      }

      if (result.type === 'failure') {
        if (result.retryOnFail && tryNum < maxTries) {
          appendLog(
            `Row ${globalIndex + 1} (try ${tryNum}/${maxTries}): ${result.category} - ${result.details}, retrying...`
          );
          continue;
        }
        return { success: false, category: result.category, details: result.details, tries: tryNum };
      }

      if (result.type === 'unknown' || result.type === 'none') {
        if (result.type === 'unknown') {
          logUnrecognizedFailure(row, globalIndex, result.message);
        } else {
          logUnrecognizedFailure(row, globalIndex, '(no toast message)');
        }
        return {
          success: false,
          category: 'unrecognized',
          details: result.type === 'unknown' ? result.message : '(no toast)',
          tries: tryNum,
        };
      }
    } catch (err) {
      if (tryNum < maxTries) {
        appendLog(`Row ${globalIndex + 1} (try ${tryNum}/${maxTries}): ${err.message}, retrying...`);
      } else {
        appendLog(`Row ${globalIndex + 1}: FAILED after ${maxTries} tries (${err.message})`);
        return { success: false, category: 'exception', details: err.message, tries: tryNum };
      }
    }
  }
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
        const category = result.category ?? 'unknown';
        const details = result.details ?? '';
        appendLog(
          `Row ${globalIndex + 1}: FAILED (${category})${details ? ` ${details}` : ''} [Load Record ${row['Load Record']}, Item ${getItemNumber(row)}]`
        );
        progressData.failedRows = progressData.failedRows || [];
        progressData.failedRows.push({
          rowIndex: globalIndex,
          loadRecord: row['Load Record'],
          itemNumber: getItemNumber(row),
          category,
          details,
          tries: result.tries ?? 1,
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
    console.log(`Failed rows (see logs/progress.json): ${progressData.failedRows.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
