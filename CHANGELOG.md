# Changelog

All notable changes are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- CLI `--help` / `--version` flags (also `help` and `version` subcommands).
- `stellar-wallet-testkit scenarios --json` and `decode --network futurenet`.
- `npm run cli` convenience script and Node 20 `.nvmrc`.
- Deterministic wallet controller with subscriptions, history, and scripted outcomes.
- Freighter-compatible object-result mock API.
- Playwright injection, test-runner-neutral module factory, and scenario presets.
- Stellar SDK-backed transaction XDR assertions and CLI.

### Fixed

- `changeAccount` rejects blank addresses.
- `changeNetwork` rejects blank network names or passphrases.
- Empty transaction, auth-entry, and message signing payloads return `INVALID_INPUT`.
- `decode --network` requires a following value instead of silently using testnet.
- Transaction XDR is trimmed and malformed parse errors keep their `cause`.
- Payment and invoke assertions reject negative operation indexes.
- A throwing wallet subscriber no longer skips remaining listeners.
- Browser injection rejects negative `delayMs` scripts.
- Scripted `delayMs` values must be non-negative finite numbers.
- Unknown `scenario()` names throw at runtime instead of returning `undefined`.

## Release process

1. Move Unreleased entries into a dated version section.
2. Run `npm ci && npm run validate && npm pack --dry-run`.
3. Review the package contents and dependency provenance.
4. Open and merge a release pull request.
5. Create a signed GitHub release and publish with npm provenance from CI.

[Unreleased]: https://github.com/aburex12345/stellar-wallet-testkit/compare/v0.1.0...HEAD
