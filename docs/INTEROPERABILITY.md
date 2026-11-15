# Wallet & dApp Interoperability Test Vector Corpus

`test-vectors/` provides a language-agnostic, versioned JSON corpus of non-secret wallet request,
response, classic Stellar transaction XDR, and Soroban authorization fixtures for wallet
implementers, browser extension bridges, and dApp SDK maintainers.

## Corpus layout

| File                                 | Purpose                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test-vectors/manifest.json`         | Top-level corpus version, Stellar protocol version, deterministic public-byte identity registry, and suite index                                                                   |
| `test-vectors/schema.json`           | Draft 2020-12 JSON Schema validating suite metadata, provenance, initial wallet state, requests, and expected object results                                                       |
| `test-vectors/wallet-lifecycle.json` | Connection, permission, network inspection, deterministic message signing, and structured error fixtures (`10` vectors)                                                            |
| `test-vectors/transactions.json`     | Classic `ENVELOPE_TYPE_TX` (native XLM, credit asset + memo, multi-op) and `ENVELOPE_TYPE_TX_FEE_BUMP` XDR fixtures (`6` vectors)                                                  |
| `test-vectors/soroban.json`          | Soroban `invokeHostFunction` contract call, `SorobanAuthorizationEntry` (`sourceAccount` & `address` credentials), and `HashIdPreimageSorobanAuthorization` fixtures (`6` vectors) |

## Versioning & protocol provenance

Every suite file and the root `manifest.json` declare explicit provenance metadata:

- **`corpusVersion` (`"1.0.0"`)**: Semantic version of the vector definitions and expected object results.
- **`schemaVersion` (`"1.0.0"`)**: Structural JSON schema version (`test-vectors/schema.json`).
- **`stellarProtocolVersion` (`22`)**: Stellar XDR protocol baseline used to encode all `TransactionEnvelope`, `SorobanAuthorizationEntry`, and `HashIdPreimage` payloads.
- **`stellarSdkVersion` (`"14.6.1"`)**: Exact `@stellar/stellar-sdk` version used to construct deterministic XDR payloads.
- **`xdrEncoding` (`"stellar-xdr-base64"`)**: Canonical base64 RFC 4506 XDR wire representation.
- **`freighterObjectResultSpec` (`"freighter-api-v2-object-result"`)**: Freighter-compatible object-result contract where runtime operational errors resolve inside `{ ..., error: { code, message } }` rather than throwing untyped exceptions.

Each individual vector also includes a `provenance` block recording:

- `generator`: Exact SDK builder or encoder used to construct the payload.
- `containsSecretMaterial`: Always `false`.
- `identitiesUsed`: Explicit foreign keys into `manifest.json#identities`.
- `deterministicConstruction`: Reproducible sequence numbers, fees, timebounds (`[0, 1767225600]`), nonces, and byte fills.
- `protocolNotes` _(optional)_: Relevant CAP / SEP / Stellar Protocol notes (for example CAP-0015 fee bumps, SEP-0043 `signAuthEntry` preimages, and Protocol 22 `SOROBAN_CREDENTIALS_ADDRESS` baseline prior to CAP-0071 delegation).

## Public-bytes-only guarantee

No private keys, seed phrases (`S...`), random keypairs, or captured user transactions exist anywhere
in `test-vectors/`. Every Stellar account (`G...`) and Soroban contract (`C...`) identifier is
deterministically encoded directly from a constant 32-byte fill:

| Identity ID            | Kind               | Fill Byte | StrKey Identifier                                          |
| ---------------------- | ------------------ | --------- | ---------------------------------------------------------- |
| `account-zero-default` | `ed25519PublicKey` | `0x00`    | `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF` |
| `account-recipient-01` | `ed25519PublicKey` | `0x01`    | `GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H` |
| `account-issuer-02`    | `ed25519PublicKey` | `0x02`    | `GABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEJXA` |
| `account-sponsor-03`   | `ed25519PublicKey` | `0x03`    | `GABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQHGPC` |
| `contract-token-11`    | `contract`         | `0x11`    | `CAIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRDB3V` |
| `contract-router-22`   | `contract`         | `0x22`    | `CARCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEVQO` |

Consumers can independently verify zero-secret provenance in any language by StrKey-decoding every
`G...` or `C...` string in the corpus and asserting the raw 32-byte payload matches
`identities[].publicBytesHex` in `test-vectors/manifest.json`.

## Expected object result shapes

All vectors follow the Freighter v2 object-result specification (`freighter-api-v2-object-result`).
Instead of rejecting promises on user denial, locked state, or mismatched networks, wallet bridges
resolve a typed object carrying empty string/boolean defaults alongside an optional `error` object:

| Operation                     | Success Result                                                    | Error Result                                                                                   |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `isConnected()`               | `{ "isConnected": true }`                                         | `{ "isConnected": false, "error": { "code": "...", "message": "..." } }`                       |
| `isAllowed()`                 | `{ "isAllowed": true }`                                           | `{ "isAllowed": false, "error": { "code": "...", "message": "..." } }`                         |
| `getAddress()`                | `{ "address": "G..." }`                                           | `{ "address": "", "error": { "code": "...", "message": "..." } }`                              |
| `requestAccess()`             | `{ "address": "G..." }`                                           | `{ "address": "", "error": { "code": "USER_DECLINED", "message": "..." } }`                    |
| `getNetwork()`                | `{ "network": "TESTNET", "networkPassphrase": "..." }`            | `{ "network": "", "networkPassphrase": "", "error": { "code": "...", "message": "..." } }`     |
| `signTransaction(xdr, opts?)` | `{ "signedTxXdr": "<base64-xdr>", "signerAddress": "G..." }`      | `{ "signedTxXdr": "", "signerAddress": "", "error": { "code": "...", "message": "..." } }`     |
| `signAuthEntry(xdr, opts?)`   | `{ "signedAuthEntry": "<base64-xdr>", "signerAddress": "G..." }`  | `{ "signedAuthEntry": "", "signerAddress": "", "error": { "code": "...", "message": "..." } }` |
| `signMessage(msg, opts?)`     | `{ "signedMessage": "<base64-marker>", "signerAddress": "G..." }` | `{ "signedMessage": "", "signerAddress": "", "error": { "code": "...", "message": "..." } }`   |

### Standard error codes in the corpus

- `WALLET_NOT_INSTALLED` — Extension/provider is absent (`installed: false`).
- `WALLET_NOT_CONNECTED` — Provider is installed but disconnected (`connected: false`).
- `USER_DECLINED` — User has not granted origin access (`allowed: false`).
- `ACCOUNT_MISMATCH` — `options.address` does not match the active wallet account.
- `NETWORK_MISMATCH` — `options.network` or `options.networkPassphrase` differs from the active wallet network.
- `INVALID_INPUT` — Empty or whitespace-only XDR or message payload.

### Non-cryptographic test signing markers

Consistent with `docs/SECURITY_MODEL.md`:

- `signTransaction` and `signAuthEntry` return the input XDR unchanged on success so dApp and bridge harnesses can test envelope plumbing without holding private keys.
- `signMessage` returns `base64("FAKE_TEST_SIGNATURE:<signerAddress>:<message>")` so consumers never mistake mock output for an Ed25519 signature.
- Vectors in `transactions.json` and `soroban.json` additionally expose `decodedExpectations` (envelope type, sequence, fee, operations, contract ID, function name, credential type, nonce, expiration ledger, and nested sub-invocations) so XDR decoders in any language can assert exact structural fields.

## Consuming the corpus outside Vitest

`test-vectors/*.json` are standalone UTF-8 JSON files with zero runtime dependencies on Vitest,
TypeScript, or Node-specific APIs. Any test runner or language ecosystem can load them directly.

### Plain Node.js (`node:test` or standalone script)

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WalletController, createFreighterMock } from "@aburex12345/stellar-wallet-testkit";

const manifest = JSON.parse(
  readFileSync(new URL("./test-vectors/manifest.json", import.meta.url), "utf8"),
);

for (const entry of manifest.suites) {
  const suite = JSON.parse(
    readFileSync(new URL(`./test-vectors/${entry.suite}.json`, import.meta.url), "utf8"),
  );
  for (const vector of suite.vectors) {
    const mock = createFreighterMock(new WalletController(vector.initialState));
    const actual = await mock[vector.request.operation](...vector.request.args);
    assert.deepStrictEqual(actual, vector.expectedResult, `Vector failed: ${vector.id}`);
  }
}
```

### Python (`pytest` + `stellar-sdk`)

```python
import json
from pathlib import Path
from stellar_sdk import StrKey, TransactionEnvelope

corpus_dir = Path("test-vectors")
manifest = json.loads((corpus_dir / "manifest.json").read_text(encoding="utf-8"))
tx_suite = json.loads((corpus_dir / "transactions.json").read_text(encoding="utf-8"))

for identity in manifest["identities"]:
    raw = (
        StrKey.decode_ed25519_public_key(identity["strKey"])
        if identity["kind"] == "ed25519PublicKey"
        else StrKey.decode_contract(identity["strKey"])
    )
    assert raw.hex() == identity["publicBytesHex"]

for vector in tx_suite["vectors"]:
    if "decodedExpectations" in vector:
        xdr_b64 = vector["request"]["args"][0]
        passphrase = vector["initialState"]["networkPassphrase"]
        env = TransactionEnvelope.from_xdr(xdr_b64, passphrase)
        assert vector["expectedResult"]["signedTxXdr"] == xdr_b64
```

### Rust (`stellar-xdr`)

```rust
use serde_json::Value;
use std::fs;
use stellar_xdr::curr::{Limits, ReadXdr, SorobanAuthorizationEntry};

fn verify_soroban_vectors() {
    let raw = fs::read_to_string("test-vectors/soroban.json").expect("read soroban.json");
    let suite: Value = serde_json::from_str(&raw).expect("parse json");
    for vector in suite["vectors"].as_array().expect("vectors array") {
        if vector["decodedExpectations"]["xdrType"] == "SorobanAuthorizationEntry" {
            let b64 = vector["request"]["args"][0].as_str().expect("auth entry xdr");
            let entry = SorobanAuthorizationEntry::from_xdr_base64(b64, Limits::none())
                .expect("valid Protocol 22 SorobanAuthorizationEntry");
            let _ = entry;
        }
    }
}
```
