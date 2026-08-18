# Examples

These files are typechecked with the package. They are not a runnable app.

## Vitest module mock

`vitest.ts` shows `createFreighterModuleMock` with a `user-rejection` preset. In a real suite, pass that object to `vi.mock("@stellar/freighter-api", ...)`.

## Playwright injection

`playwright.ts` shows `installFreighterMock` on a structural page type. Call it before `page.goto` so the app sees `window.freighterApi` without a browser extension.

```sh
npx tsc --noEmit
```
