/**
 * Selectors and settings - from Playwright codegen.
 * Format: { role: 'textbox', name: 'X' } or { role: 'button', name: 'Y' } for getByRole,
 * or { css: 'selector' } for page.locator().
 */

export const config = {
  selectors: {
    // Microsoft OAuth login (email + Next, then MFA on your phone)
    emailInput: { role: "textbox", name: "Enter your email, phone, or" },
    nextButton: { role: "button", name: "Next" },

    // App form (item/add page)
    loadRecordInput: { role: "textbox", name: "Load Number" },
    itemNumInput: { role: "textbox", name: "Item Number" },
    priceField: { css: '[id=":r3t:"]' }, // MUI ID - may change; run codegen again if broken
    saveButton: { role: "button", name: "Save" },

    // Error toast (MUI Alert)
    errorToast: { css: ".MuiAlert-message" },
  },

  timeout: 30000,
  networkIdleWait: 2000,
  postSaveWait: 5000,
  mfaWaitTimeout: 120000, // 2 min to complete Authenticator on phone
  maxRetries: 2, // Retries per row when Save fails (error toast)
};
