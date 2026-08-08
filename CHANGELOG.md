# Changelog

All notable changes are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Deterministic wallet controller with subscriptions, history, and scripted outcomes.
- Freighter-compatible object-result mock API.
- Playwright injection, test-runner-neutral module factory, and scenario presets.
- Stellar SDK-backed transaction XDR assertions and CLI.

## Release process

1. Move Unreleased entries into a dated version section.
2. Run `npm ci && npm run validate && npm pack --dry-run`.
3. Review the package contents and dependency provenance.
4. Open and merge a release pull request.
5. Create a signed GitHub release and publish with npm provenance from CI.

[Unreleased]: https://github.com/aburex12345/stellar-wallet-testkit/compare/v0.1.0...HEAD
