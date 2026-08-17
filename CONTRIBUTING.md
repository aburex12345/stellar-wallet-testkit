# Contributing

Thank you for improving Stellar wallet testing.

## Before opening a change

1. Search existing issues and choose or propose a focused scope.
2. For behavior or API changes, describe the production Freighter behavior being modeled.
3. Never add a seed phrase, secret key, live-wallet fixture, or captured user transaction.
4. Keep Playwright and test-runner integrations structurally typed so they remain optional.

## Local workflow

Use Node 20 or 22 and npm:

```sh
npm ci
npm run validate
npm pack --dry-run
npm run cli -- --help
```

Add meaningful tests for success, failure, and state-transition paths. New public APIs require
documentation and a changeset in `CHANGELOG.md` under **Unreleased**. Tests must be deterministic
and offline.

## Commits and pull requests

Use a concise imperative summary. Keep pull requests reviewable, complete the template, link the
issue, and note compatibility or security effects. Maintainers may request a design issue before a
large API change.

## Contributor issues

`docs/wave-issues.json` is the source of truth for the curated issue catalog. After changing it,
run `npm run issues:render` and include the generated `docs/WAVE_ISSUES.md`. The issue creation
script supports a safe dry run.

All participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
