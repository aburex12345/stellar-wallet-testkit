# Scenario Guide

Presets are passed to `new WalletController(scenario(name))` or directly to
`createFreighterModuleMock`.

## Included presets

- `user-rejection`: the next access request returns `USER_DECLINED`.
- `wallet-missing`: installation, connection, and permission are false.
- `wrong-network`: wallet reports Stellar public network while most tests expect testnet.
- `timeout`: the next access request remains pending; race it against the application's timeout.
- `account-changed`: the next address read changes to a second deterministic public address.
- `malformed-signature-response`: the next transaction result contains `not-xdr`.
- `signing-failure`: the next transaction signature returns `SIGNING_FAILED`.

Presets return new options each call. Scripted behaviors are FIFO and one-shot.

List the same names from the CLI with `stellar-wallet-testkit scenarios` or
`stellar-wallet-testkit scenarios --json`.

## Custom sequences

```ts
const controller = new WalletController();
controller.enqueue({ operation: "getAddress", delayMs: 100 }).enqueue({
  operation: "getAddress",
  statePatch: { address: secondAddress },
});
```

Use controller subscriptions to observe test state. In browsers, call
`window.__stellarWalletTestkit.setState` or `enqueue`. Applications should continue using their
real refresh/polling behavior; the testkit does not add a fictional Freighter event API.

Timeout scripts intentionally never settle. Tests must use their own timeout or `Promise.race` and
must not await the operation without a bound.
