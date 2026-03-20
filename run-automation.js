#!/usr/bin/env node
/**
 * Playwright Browser Automation
 *
 * Reads rows from a CSV file and, for each row:
 * - Opens the app URL
 * - Logs in if a login screen is shown
 * - Enters Load Record, Tab, Item Num, Enter
 * - Waits for page to finish loading/rerendering
 * - Makes a trivial change (price +1 cent, then back) to enable Save
 * - Clicks Save
 *
 * Usage:
 *   npm start                    # Process all rows (or use --csv path)
 *   npm run test:sample          # Process first 5 rows only
 *   node run-automation.js --csv myfile.csv --limit 10
 */

import { chromium } from 'playwright';
import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './config.js';

// --- Parse CLI args ---
const args = process.argv.slice(2);
const csvIndex = args.indexOf('--csv');
const limitIndex = args.indexOf('--limit');
const csvPath = csvIndex >= 0 ? args[csvIndex + 1] : 'sample-data.csv';
const rowLimit = limitIndex >= 0 ? parseInt(args[limitIndex + 1], 10) : null;

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
const rows = parse(csvText, { columns: true, skip_empty_lines: true });

const rowsToProcess = rowLimit ? rows.slice(0, rowLimit) : rows;
console.log(`Processing ${rowsToProcess.length} rows from ${csvPath}`);

// --- Helpers ---
async function maybeLogin(page) {
  const loginBtn = page.locator(config.selectors.loginButton).first();
  if (await loginBtn.isVisible().catch(() => false)) {
    console.log('  Login screen detected, logging in...');
    await page.fill(config.selectors.usernameInput, credentials.username);
    await page.fill(config.selectors.passwordInput, credentials.password);
    await loginBtn.click();
    await page.waitForLoadState('networkidle', { timeout: config.timeout }).catch(() => {});
  }
}

async function processRow(page, row, index) {
  const loadRecord = row['Load Record']?.trim();
  const itemNum = row['Item Num']?.trim();
  if (!loadRecord || !itemNum) {
    console.log(`  [${index + 1}] Skipping: missing Load Record or Item Num`);
    return;
  }

  console.log(`  [${index + 1}] Load Record: ${loadRecord}, Item Num: ${itemNum}`);

  // Ensure we're on the right page
  await page.goto(credentials.url, { waitUntil: 'domcontentloaded', timeout: config.timeout });
  await maybeLogin(page);

  // Enter Load Record
  const firstInput = page.locator(config.selectors.loadRecordInput).first();
  await firstInput.waitFor({ state: 'visible', timeout: config.timeout });
  await firstInput.fill(loadRecord);
  await firstInput.press('Tab');

  // Enter Item Num
  const itemInput = page.locator(config.selectors.itemNumInput).first();
  await itemInput.waitFor({ state: 'visible', timeout: config.timeout });
  await itemInput.fill(itemNum);
  await itemInput.press('Enter');

  // Wait for page to finish rerendering (network idle + buffer)
  await page.waitForLoadState('networkidle', { timeout: config.timeout }).catch(() => {});
  await new Promise((r) => setTimeout(r, config.networkIdleWait));

  // Make trivial change to Price: +$0.01 then back
  const priceLoc = page.locator(config.selectors.priceField).first();
  if (await priceLoc.isVisible().catch(() => false)) {
    const currentPrice = await priceLoc.inputValue();
    const num = parseFloat(currentPrice.replace(/[^0-9.-]/g, '')) || 0;
    const newPrice = (num + 0.01).toFixed(2);
    await priceLoc.fill(newPrice);
    await priceLoc.fill(currentPrice);
  }

  // Save
  const saveBtn = page.locator(config.selectors.saveButton).first();
  await saveBtn.click();
  await page.waitForLoadState('networkidle', { timeout: config.timeout }).catch(() => {});
}

// --- Main ---
async function main() {
  const browser = await chromium.launch({ headless: false }); // set to true for background runs
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    for (let i = 0; i < rowsToProcess.length; i++) {
      await processRow(page, rowsToProcess[i], i);
    }
  } finally {
    await browser.close();
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
