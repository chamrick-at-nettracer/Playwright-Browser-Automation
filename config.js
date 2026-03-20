/**
 * Selectors and settings - CUSTOMIZE THESE for your app.
 * Use browser DevTools (F12) to inspect elements and copy selectors.
 */

export const config = {
  // Page selectors - update these to match your app's HTML
  selectors: {
    // Login form (when presented)
    usernameInput: 'input[name="username"], input[id="username"], input[type="text"]',
    passwordInput: 'input[name="password"], input[id="password"], input[type="password"]',
    loginButton: 'button[type="submit"], input[type="submit"], button:has-text("Log in")',

    // Search / lookup form
    loadRecordInput: 'input[name="loadRecord"], input[id="loadRecord"], input:first-of-type',
    itemNumInput: 'input[name="itemNum"], input[id="itemNum"], input:nth-of-type(2)',

    // After item loads - the Price field to make trivial change
    priceField: 'input[name="price"], input[id="price"], [data-field="price"] input',

    // Save button
    saveButton: 'button:has-text("Save"), input[type="submit"][value="Save"], [data-action="save"]',

    // Error toast (MUI Alert) - if visible after Save, indicates failure
    errorToast: '.MuiAlert-message',
  },

  // Timeouts (milliseconds)
  timeout: 30000,
  networkIdleWait: 2000, // Extra wait after network idle
  postSaveWait: 5000, // Wait after Save before checking for error toast
};
