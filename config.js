/**
 * Selectors and settings - from Playwright codegen.
 * Format: { role: 'textbox', name: 'X' } or { role: 'button', name: 'Y' } for getByRole,
 * or { css: 'selector' } for page.locator().
 */

export const config = {
  selectors: {
    // Microsoft OAuth login (email + Next, then MFA on your phone)
    emailInput: [
      { role: "textbox", name: "Enter your email, phone, or" },
      { role: "textbox", name: "Email, phone, or Skype" },
      { css: "input[type='email'], input[name='loginfmt']" },
    ],
    nextButton: { role: "button", name: "Next" },

    // App form (item/add page)
    loadRecordInput: { role: "textbox", name: "Load Number" },
    itemNumInput: { role: "textbox", name: "Item Number" },
    priceField: { css: '[id=":r3t:"]' }, // MUI ID - may change; run codegen again if broken
    saveButton: { role: "button", name: "Save" },

    // Toast message (MUI Alert - success or failure; text is read to classify)
    errorToast: { css: ".MuiAlert-message" },
  },

  // Max wait (ms) for: page navigation (goto), element visibility (waitFor), network idle
  timeout: 10000,

  // Extra wait (ms) after network goes idle — lets the UI finish updating before we interact
  networkIdleWait: 2000,

  // Wait (ms) after clicking Save before reading the toast message — lets the toast appear
  postSaveWait: 2000,

  // Polling to detect form vs login: wait this long between each check
  arrivalCheckIntervalMs: 2000,
  // Max polling attempts before giving up (total wait up to interval × attempts)
  arrivalCheckMaxAttempts: 5,
  mfaWaitTimeout: 120000, // 2 min to complete Authenticator on phone
  maxRetries: 3, // Max retries per row when Save fails and retryOnFail is true

  // Toast-based success/failure detection
  successToastRegExp: /successfully/i,
  failureReasons: [
    {
      category: "missing or invalid required fields",
      failureReasonRegExp: /^Please fix the following fields: /,
      failureDetailsRegExp: /^Please fix the following fields: (.+)$/,
      retryOnFail: false,
    },
    {
      category: "condition not selected",
      failureReasonRegExp: /^Please select a condition/,
      failureDetailsRegExp: null,
      retryOnFail: false,
    },
    // Add more failure categories here as discovered
  ],
};
