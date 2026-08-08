# Stellar Wallet Testkit

[![CI](https://github.com/aburex12345/stellar-wallet-testkit/actions/workflows/ci.yml/badge.svg)](https://github.com/aburex12345/stellar-wallet-testkit/actions/workflows/ci.yml)
[![CodeQL](https://github.com/aburex12345/stellar-wallet-testkit/actions/workflows/codeql.yml/badge.svg)](https://github.com/aburex12345/stellar-wallet-testkit/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Deterministic, reusable wallet testing infrastructure for Stellar and Soroban dApps. It
models wallet state, exposes a Freighter-compatible object-result API, injects into real
browsers without an extension, and provides typed transaction XDR assertions.

> **Status:** pre-1.0 and ready for evaluation and contributors. The implemented baseline is
> functional and tested; API feedback is welcome before the first stable release.

## Why this exists

Wallet integration tests often stop at a happy-path module stub or require an installed browser
extension. Both approaches make rejection, disconnection, account changes, wrong networks, and
timeouts difficult to reproduce. Stellar Wallet Testkit puts these states under test control.

Unlike a generic mock, it provides:

- an explicit wallet state machine and queued one-shot behaviors;
- current Freighter-style `{ value, error? }` result objects;
- browser injection through Playwright's `addInitScript`;
- test-runner-neutral module mocks;
- Stellar SDK-backed assertions that reject malformed XDR; and
- no seed phrases, secret keys, network calls, or extension installation.

This project focuses on Stellar. EIP-6963 and Ethereum provider semantics are intentionally out of
scope.

## Install

```sh
npm install --save-dev @aburex12345/stellar-wallet-testkit
```

Node.js 20 or newer is required. `@stellar/stellar-sdk` is a runtime dependency. Playwright,
Vitest, and Jest are not runtime dependencies.

## Unit-test quickstart

```ts
import { createFreighterModuleMock, scenario } from "@aburex12345/stellar-wallet-testkit";
import { vi } from "vitest";

const freighter = createFreighterModuleMock(scenario("user-rejection"));
vi.mock("@stellar/freighter-api", () => freighter);

const result = await freighter.requestAccess();
expect(result.error?.code).toBe("USER_DECLINED");
```

The factory returns plain functions, so the equivalent Jest call is:

```ts
jest.mock("@stellar/freighter-api", () => createFreighterModuleMock());
```

## Controller quickstart

```ts
import { createFreighterMock, WalletController } from "@aburex12345/stellar-wallet-testkit";

const wallet = new WalletController({ allowed: false });
const api = createFreighterMock(wallet);

wallet.subscribe((event) => console.log(event.type, event.state));
wallet.allow();
wallet.enqueue({
  operation: "signTransaction",
  error: { code: "USER_DECLINED", message: "User rejected signing." },
});

await api.signTransaction(transactionXdr);
```

Scripts are FIFO and consumed once. They can return a result, return an object-result error, apply a
state patch, delay, or stay pending to model a timeout.

## Playwright quickstart

The package uses a structural page interface and does not import Playwright:

```ts
import { installFreighterMock } from "@aburex12345/stellar-wallet-testkit/playwright";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await installFreighterMock(page, { network: "TESTNET" });
  await page.goto("/");
});

test("handles account changes", async ({ page }) => {
  await page.evaluate(() => {
    window.__stellarWalletTestkit.setState({ address: "GB..." });
  });
  await expect(page.getByTestId("wallet-address")).toContainText("GB");
});
```

`installFreighterMock` must run before `page.goto`. It installs `window.freighterApi` and a
test-only `window.__stellarWalletTestkit` control channel in every new document. A fixture factory
is also exported:

```ts
import { walletFixture } from "@aburex12345/stellar-wallet-testkit/playwright";

export const test = base.extend({
  wallet: walletFixture({ allowed: true }),
});
```

## XDR assertions

```ts
import {
  assertOperationCount,
  assertPayment,
  assertSource,
  decodeEnvelope,
} from "@aburex12345/stellar-wallet-testkit";
import { Asset, Networks } from "@stellar/stellar-sdk";

const decoded = decodeEnvelope(transactionXdr, Networks.TESTNET);
assertSource(decoded, expectedAccount);
assertOperationCount(decoded, 1);
assertPayment(decoded, {
  destination: merchant,
  amount: "25.0000000",
  asset: Asset.native(),
});
```

Network passphrases are not stored in transaction XDR. `assertTransactionNetwork` therefore checks
the network context supplied by the test; it does not claim to infer a network from an envelope.

## API overview

- `WalletController`: state transitions, subscriptions, FIFO scripts, operation history.
- `createFreighterMock`: `getAddress`, `getNetwork`, `requestAccess`, `isConnected`, `isAllowed`,
  `signTransaction`, `signAuthEntry`, and `signMessage`.
- `createFreighterModuleMock`: named/default module shape for any runner.
- `installFreighterMock`, `walletFixture`: extension-free browser testing.
- `scenario`: seven reusable failure and lifecycle presets.
- `decodeEnvelope` and assertions: source, network context, count, payment, contract invocation.
- `stellar-wallet-testkit scenarios|decode`: inspect presets or decode transaction XDR.

Freighter does not currently expose a general account/network event subscription in the methods
emulated here. The testkit does not invent one on `freighterApi`; use `WalletController.subscribe`
in module tests or the browser control channel to drive state, then let the application poll or
refresh exactly as it does in production.

## Security limitations

This is test infrastructure, not a wallet:

- It never stores or generates secret keys.
- Transaction and authorization-entry “signing” returns the input unchanged by default.
- Message signatures are deterministic strings containing `FAKE_TEST_SIGNATURE`, base64 encoded.
- Outputs must never be submitted as authenticated signatures or used in production.
- XDR decoding does not establish intent, authorization, or network provenance.

Read [the security model](docs/SECURITY_MODEL.md) and report vulnerabilities according to
[SECURITY.md](SECURITY.md).

## Development

```sh
npm install
npm run validate
npm pack --dry-run
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/ARCHITECTURE.md), and the
[contributor issue catalog](docs/WAVE_ISSUES.md).

## Roadmap

Near-term work includes closer compatibility validation against released Freighter versions,
deeper Soroban authorization assertions, browser adapters beyond Playwright, and opt-in
cryptographic test signing isolated from the default fake signer. See [docs/ROADMAP.md](docs/ROADMAP.md).

## License

[MIT](LICENSE) © contributors.
