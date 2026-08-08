# Governance

Stellar Wallet Testkit uses a maintainer-led, contributor-informed model.

## Roles

- **Contributors** propose issues, code, tests, and documentation.
- **Reviewers** are trusted contributors who may triage and review but cannot publish.
- **Maintainers** set scope, merge changes, manage releases, and handle security reports.

The initial maintainer is `@aburex12345`. Review and maintainer status is earned through sustained,
constructive contributions and sound judgment. A maintainer nomination requires public rationale
and no unresolved objection from existing maintainers for seven days.

## Decisions

Routine changes use pull-request consensus. Public API breaks, security-model changes, new signing
capabilities, and governance changes require a design issue open for at least seven days. The
maintainer decides if consensus cannot be reached and records the rationale.

## Releases

Releases follow semantic versioning. Before 1.0, minor releases may include documented breaking
changes. A release must pass CI, have a changelog entry, and be built from a reviewed commit.

## Inactivity and succession

Maintainers inactive for six months may move to emeritus status after notice. If no maintainer is
responsive for 60 days, active reviewers may select a successor in a public governance issue.
