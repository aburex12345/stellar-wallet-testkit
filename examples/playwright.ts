import { installFreighterMock, type InitScriptPage } from "../src/playwright.js";

// A Playwright Page satisfies InitScriptPage structurally; no Playwright runtime
// dependency is required by this package or example.
export async function configureWalletBeforeNavigation(page: InitScriptPage): Promise<void> {
  await installFreighterMock(page, {
    allowed: true,
    scripts: [
      {
        operation: "signTransaction",
        delayMs: 25,
      },
    ],
  });

  // In a real test, call page.goto(...) only after this function resolves.
}
