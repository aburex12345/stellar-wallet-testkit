# Security Model

## Assets protected

The project must not expose real private keys, produce signatures confused with wallet approval,
silently weaken application production code, or parse untrusted XDR without bounded failure.

## Trust boundaries

- Test code controls all controller state and scripts.
- Browser injection runs in the application page, not an extension-isolated context.
- `@stellar/stellar-sdk` is trusted for XDR parsing and operation decoding.
- Consumer applications are responsible for keeping the testkit out of production bundles.

## Signing behavior

No secret keys are generated or accepted. Transaction and auth-entry signing returns the input
unchanged by default. Message signing returns base64-encoded text prefixed with
`FAKE_TEST_SIGNATURE`. These outputs prove only that an application handled a response shape.

An eventual deterministic cryptographic signer must live in an opt-in entry point, use a clearly
published non-secret test vector, avoid default exports, and label every result as test-only.

## XDR limitations

Parsing proves structural validity, not authorization, safety, or network provenance. A network
passphrase is outside transaction XDR; callers supply that context. Assertion error messages avoid
including secret material, but transaction data itself may be sensitive and should not be logged in
shared CI.

## Operational controls

CI runs dependency review and CodeQL. Releases should use npm provenance and protected GitHub
environments. Secret scanning and branch protection belong in repository settings and cannot be
enforced by package code.
