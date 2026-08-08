# Wave Contributor Issues

This catalog is generated from [wave-issues.json](wave-issues.json), the machine-readable source of
truth. Each issue extends the implemented baseline; none asks a contributor to build the core
project from scratch. Run `npm run issues:render` after source changes.

## Core state machine

### 1. Add named reusable behavior sequence builders

**Difficulty:** beginner · **Type:** enhancement

**Context:** The controller supports FIFO scripts, but repeated multi-step sequences are verbose.

**Scope/tasks:**

- Design a composeBehaviors helper
- Preserve one-shot ordering
- Document composition examples

**Acceptance criteria:**

- Sequences cannot share mutable queues
- Existing behavior objects remain supported
- Public types are exported

**Likely files:** `src/controller.ts`, `src/types.ts`, `docs/SCENARIOS.md`

**Tests:** Unit tests for composition, reuse, and ordering

### 2. Add operation call records with sanitized arguments

**Difficulty:** intermediate · **Type:** enhancement

**Context:** History records operation names but cannot support assertions about supplied signing options.

**Scope/tasks:**

- Define typed call-record unions
- Record sanitized options without full XDR
- Add history filtering helpers

**Acceptance criteria:**

- Raw transaction and message payloads are excluded by default
- Records are immutable snapshots
- Current history API remains compatible

**Likely files:** `src/controller.ts`, `src/types.ts`

**Tests:** Argument redaction, ordering, filtering, and immutability tests

### 3. Support abort signals for scripted delays

**Difficulty:** intermediate · **Type:** enhancement

**Context:** Pending timeout scenarios can retain promises longer than a test needs.

**Scope/tasks:**

- Accept an optional AbortSignal in controller execution
- Cancel delays and timeout scripts
- Define a stable cancellation error

**Acceptance criteria:**

- Already-aborted and later-aborted signals behave consistently
- Timers are cleaned up
- Default API behavior is unchanged

**Likely files:** `src/controller.ts`, `src/types.ts`

**Tests:** Fake-timer tests for delay and never-settling behavior cancellation

### 4. Validate wallet state transition invariants

**Difficulty:** beginner · **Type:** quality

**Context:** Direct state patches can currently represent allowed while disconnected, which may be useful but surprising.

**Scope/tasks:**

- Document strict and permissive modes
- Implement opt-in strict validation
- Return actionable invariant errors

**Acceptance criteria:**

- Permissive mode remains default
- Strict mode rejects three invalid prerequisite combinations
- Scripted patches use the same validator

**Likely files:** `src/controller.ts`, `src/types.ts`, `docs/ARCHITECTURE.md`

**Tests:** Table-driven strict and permissive transition tests

### 5. Add controller reset and snapshot restore APIs

**Difficulty:** beginner · **Type:** enhancement

**Context:** Test suites need a concise way to restore baseline state between cases.

**Scope/tasks:**

- Define serializable snapshots
- Implement reset and restore
- Clarify whether scripts and history are included

**Acceptance criteria:**

- Snapshots do not expose mutable internals
- Reset semantics are documented
- Restore emits one coherent event

**Likely files:** `src/controller.ts`, `src/types.ts`, `docs/SCENARIOS.md`

**Tests:** State, queue, history, and subscription restore tests

### 6. Add deterministic virtual clock integration

**Difficulty:** advanced · **Type:** enhancement

**Context:** Delay scripts use global timers and require runner-specific fake timers for instant tests.

**Scope/tasks:**

- Define a minimal Clock interface
- Inject a default real clock
- Provide a manually advanced test clock

**Acceptance criteria:**

- No runner dependency is introduced
- Concurrent delays settle in deterministic order
- Browser serialization has a documented strategy

**Likely files:** `src/controller.ts`, `src/types.ts`, `src/playwright.ts`

**Tests:** Concurrent scheduling, cancellation, and real-clock compatibility tests

## Freighter compatibility

### 7. Create a Freighter compatibility contract matrix

**Difficulty:** intermediate · **Type:** compatibility

**Context:** The adapter targets current object-result APIs but supported package versions are not machine-verified.

**Scope/tasks:**

- Select representative Freighter API releases
- Capture public TypeScript shapes
- Run compile-only contract fixtures in CI

**Acceptance criteria:**

- Matrix names exact supported versions
- No extension installation is required
- Breaking upstream drift fails clearly

**Likely files:** `tests/compatibility`, `docs/ARCHITECTURE.md`, `.github/workflows/ci.yml`

**Tests:** Compile fixtures against every declared supported version

### 8. Model requestAccess approval as a state transition

**Difficulty:** intermediate · **Type:** compatibility

**Context:** requestAccess currently reports denied state unless a script explicitly changes it.

**Scope/tasks:**

- Verify released Freighter behavior
- Add an opt-in auto-approve policy
- Keep explicit rejection scripts authoritative

**Acceptance criteria:**

- Policy defaults are documented
- Approval updates allowed state before returning
- Browser and module adapters match

**Likely files:** `src/adapter.ts`, `src/playwright.ts`, `docs/SCENARIOS.md`

**Tests:** Approval, rejection, disconnected, and scripted override tests

### 9. Add getUserInfo compatibility support

**Difficulty:** intermediate · **Type:** enhancement

**Context:** Recent Freighter integrations may use account metadata beyond getAddress.

**Scope/tasks:**

- Confirm the current result schema
- Add typed controller state
- Implement browser and module adapter methods

**Acceptance criteria:**

- Types match a documented upstream release
- Missing fields are not invented
- Private account data is never accepted

**Likely files:** `src/types.ts`, `src/adapter.ts`, `src/playwright.ts`

**Tests:** Compatibility fixtures and state-change tests

### 10. Add addToken result modeling

**Difficulty:** beginner · **Type:** enhancement

**Context:** Token onboarding flows need deterministic acceptance and rejection coverage.

**Scope/tasks:**

- Verify addToken options and result shape
- Add a scripted operation
- Document that no token is persisted outside controller state

**Acceptance criteria:**

- Success, duplicate, malformed, and rejection results are typed
- No network lookup occurs
- Browser parity is maintained

**Likely files:** `src/types.ts`, `src/adapter.ts`, `src/playwright.ts`

**Tests:** Object-result shape and scripted error tests

### 11. Validate signing option precedence against Freighter

**Difficulty:** advanced · **Type:** compatibility

**Context:** Freighter gives network names precedence over custom passphrases; edge behavior needs contract tests.

**Scope/tasks:**

- Build an upstream-observation fixture
- Encode network precedence rules
- Document conflicting option behavior

**Acceptance criteria:**

- Named and custom network cases match upstream
- Unknown network names return realistic errors
- All signing methods share validation

**Likely files:** `src/adapter.ts`, `src/playwright.ts`, `tests/compatibility`

**Tests:** Table-driven option precedence matrix

### 12. Normalize all Freighter API error codes

**Difficulty:** intermediate · **Type:** quality

**Context:** Error codes are currently useful testkit identifiers but need a verified relationship to upstream errors.

**Scope/tasks:**

- Inventory upstream errors
- Create a typed error-code catalog
- Mark testkit-only codes explicitly

**Acceptance criteria:**

- Every adapter error uses the catalog
- Messages remain human-readable
- Migration notes cover renamed codes

**Likely files:** `src/adapter.ts`, `src/types.ts`, `docs/SCENARIOS.md`

**Tests:** Exhaustive error-code snapshots for public methods

## XDR assertions

### 13. Add fee-bump envelope construction tests

**Difficulty:** intermediate · **Type:** testing

**Context:** decodeEnvelope supports fee-bump transactions but the baseline suite only covers ordinary envelopes.

**Scope/tasks:**

- Build public-key-only fee-bump fixtures
- Assert inner source and operation behavior
- Cover malformed fee-bump envelopes

**Acceptance criteria:**

- No secret keys are used
- feeBump is true for valid fixtures
- Inner transaction assertions work unchanged

**Likely files:** `tests/xdr.test.ts`

**Tests:** Valid, malformed, and wrong-envelope-type fee-bump cases

### 14. Add Soroban auth entry decoder

**Difficulty:** advanced · **Type:** enhancement

**Context:** signAuthEntry can be mocked, but tests cannot inspect authorization entry details.

**Scope/tasks:**

- Decode supported auth-entry XDR variants
- Return typed credentials and invocation data
- Normalize malformed input errors

**Acceptance criteria:**

- Address and source-account credential variants are covered
- CAP-71 handling is version documented
- No signing is performed

**Likely files:** `src/auth-xdr.ts`, `src/index.ts`, `docs/ARCHITECTURE.md`

**Tests:** SDK-generated fixtures for each credential variant and malformed XDR

### 15. Assert Soroban contract function names and arguments

**Difficulty:** advanced · **Type:** enhancement

**Context:** assertInvokeContract checks only the target contract.

**Scope/tasks:**

- Expose typed function-name extraction
- Add ScVal argument matchers
- Provide readable mismatch formatting

**Acceptance criteria:**

- Symbols, addresses, integers, and vectors are supported
- Large values are safely abbreviated
- Contract target assertions remain compatible

**Likely files:** `src/xdr.ts`, `src/index.ts`

**Tests:** Function and nested argument success and mismatch tests

### 16. Add operation sequence assertions

**Difficulty:** beginner · **Type:** enhancement

**Context:** Consumers often need to verify ordered operation types before checking details.

**Scope/tasks:**

- Add assertOperationTypes
- Return narrowed operations where practical
- Write concise mismatch messages

**Acceptance criteria:**

- Order and exact length are checked
- Unknown operation types remain representable
- Fee-bump inner operations work

**Likely files:** `src/xdr.ts`, `src/index.ts`

**Tests:** Empty, matching, reordered, and extra-operation cases

### 17. Add memo and time-bounds assertions

**Difficulty:** intermediate · **Type:** enhancement

**Context:** Payment safety tests frequently depend on memo and transaction validity bounds.

**Scope/tasks:**

- Add typed memo assertions
- Support time and ledger bounds
- Explain absent versus unbounded values

**Acceptance criteria:**

- Text, id, hash, and return memo variants are covered
- Big integer values are compared safely
- Mismatch errors identify the field

**Likely files:** `src/xdr.ts`, `src/index.ts`

**Tests:** Every memo variant plus bounded and unbounded transactions

### 18. Add fuzz tests for malformed transaction XDR

**Difficulty:** advanced · **Type:** security

**Context:** A small malformed corpus cannot reveal all parser wrapper failure modes.

**Scope/tasks:**

- Add deterministic mutation-based fuzzing
- Bound input sizes and runtime
- Save minimal regression seeds

**Acceptance criteria:**

- The suite is deterministic in CI
- All failures become InvalidTransactionXdrError
- No test exceeds documented resource bounds

**Likely files:** `tests/xdr-fuzz.test.ts`, `vitest.config.ts`, `docs/SECURITY_MODEL.md`

**Tests:** Truncation, bit-flip, invalid discriminator, and oversized input mutations

## Browser integrations

### 19. Run browser injection tests in Chromium

**Difficulty:** intermediate · **Type:** testing

**Context:** The baseline tests execute the init function structurally rather than in a browser realm.

**Scope/tasks:**

- Add a minimal static page
- Install Playwright as an optional dev tool
- Exercise injection before navigation

**Acceptance criteria:**

- Tests run headlessly in CI
- No extension is installed
- Runtime state changes and scripts are covered

**Likely files:** `tests/browser`, `playwright.config.ts`, `.github/workflows/ci.yml`

**Tests:** Address, network, rejection, account change, and history browser tests

### 20. Add browser parity tests for long message payloads

**Difficulty:** beginner · **Type:** testing

**Context:** Unicode message handling is covered, but large payload behavior and Node/browser parity are not bounded.

**Scope/tasks:**

- Define representative payload size cases
- Compare Node and browser fake output bytes
- Document a practical test payload limit

**Acceptance criteria:**

- Empty, Unicode, 64 KiB, and bounded failure cases are covered
- Node and browser outputs match
- Tests do not allocate unbounded strings

**Likely files:** `src/adapter.ts`, `src/playwright.ts`

**Tests:** Empty, Unicode, long-message, and Node/browser parity cases

### 21. Add Cypress window injection adapter

**Difficulty:** intermediate · **Type:** enhancement

**Context:** The serialized browser mock can support Cypress without adding it as a runtime dependency.

**Scope/tasks:**

- Define a structural Cypress hook interface
- Reuse a shared browser installer payload
- Document before-load usage

**Acceptance criteria:**

- Cypress is optional
- Behavior matches Playwright injection
- No browser implementation is duplicated

**Likely files:** `src/browser.ts`, `src/cypress.ts`, `docs/ARCHITECTURE.md`

**Tests:** Structural adapter tests and one optional Cypress smoke example

### 22. Add WebdriverIO browser injection adapter

**Difficulty:** intermediate · **Type:** enhancement

**Context:** WebdriverIO users need a preload-script path using the same wallet semantics.

**Scope/tasks:**

- Research preload support
- Define structural browser interfaces
- Document lifecycle limitations

**Acceptance criteria:**

- No WebdriverIO runtime dependency is added
- New documents receive the mock
- Unsupported drivers fail clearly

**Likely files:** `src/webdriverio.ts`, `src/browser.ts`, `README.md`

**Tests:** Structural tests plus supported/unsupported capability cases

### 23. Share adapter semantics between Node and browser

**Difficulty:** advanced · **Type:** refactor

**Context:** Serialization constraints currently cause similar result logic in two implementations.

**Scope/tasks:**

- Extract a serializable protocol model
- Generate or share result semantics
- Preserve tree-shaking and browser safety

**Acceptance criteria:**

- Compatibility behavior has one source of truth
- Injected code has no Node globals
- Bundle size regression is measured

**Likely files:** `src/adapter.ts`, `src/playwright.ts`, `src/browser.ts`

**Tests:** Node/browser contract suite runs identical vectors

### 24. Add content security policy integration guidance

**Difficulty:** beginner · **Type:** documentation

**Context:** Strict test deployments may restrict inline or evaluated initialization scripts.

**Scope/tasks:**

- Document how addInitScript interacts with CSP
- Add known browser caveats
- Provide a safe troubleshooting checklist

**Acceptance criteria:**

- Guidance distinguishes page CSP from test-runner injection
- No production CSP weakening is recommended
- Examples cover common failures

**Likely files:** `README.md`, `docs/SECURITY_MODEL.md`

**Tests:** Documentation links checked in CI

## Quality and developer experience

### 25. Raise branch coverage for browser controls

**Difficulty:** beginner · **Type:** testing

**Context:** Browser control queue clearing and scripted error branches need direct coverage.

**Scope/tasks:**

- Identify uncovered browser branches
- Add behavior-focused tests
- Raise the branch threshold without exclusions

**Acceptance criteria:**

- Project branch coverage reaches 85 percent
- Tests do not assert implementation-only details
- No ignore comments are added

**Likely files:** `tests/playwright.test.ts`, `vitest.config.ts`

**Tests:** Scripted string/object errors, clearScripts, mismatch, and delay cases

### 26. Add API Extractor compatibility reports

**Difficulty:** intermediate · **Type:** quality

**Context:** Pre-1.0 API evolution still benefits from reviewable declaration snapshots.

**Scope/tasks:**

- Configure API Extractor
- Commit a canonical report
- Run drift checks in CI

**Acceptance criteria:**

- All public exports are represented
- Intentional changes have a documented update command
- Internal types stay hidden

**Likely files:** `api-extractor.json`, `etc`, `package.json`, `.github/workflows/ci.yml`

**Tests:** Build and API report checks

### 27. Add package consumer smoke projects

**Difficulty:** intermediate · **Type:** testing

**Context:** Source tests do not prove the packed export map works for real consumers.

**Scope/tasks:**

- Pack the package in CI
- Install into ESM TypeScript fixtures
- Import root, mock, and Playwright entry points

**Acceptance criteria:**

- Fixtures install from the generated tarball
- Types and runtime imports both execute
- Only published files are used

**Likely files:** `tests/consumers`, `scripts/test-package.mjs`, `.github/workflows/ci.yml`

**Tests:** Node 20 and 22 packed-package smoke tests

### 28. Improve CLI decode input handling

**Difficulty:** beginner · **Type:** enhancement

**Context:** Long XDR values are inconvenient and potentially visible in shell history.

**Scope/tasks:**

- Accept stdin and file input
- Make input modes mutually exclusive
- Document exit codes

**Acceptance criteria:**

- stdin, file, and argument modes work
- No input content is printed on errors
- Malformed files exit with code 2

**Likely files:** `src/cli.ts`, `README.md`

**Tests:** CLI subprocess tests for all input modes and exit codes

### 29. Add documentation link and example checks

**Difficulty:** beginner · **Type:** documentation

**Context:** A contributor-focused repository needs confidence that links and code snippets stay current.

**Scope/tasks:**

- Select lightweight offline tooling
- Check local Markdown links
- Compile extracted or dedicated examples

**Acceptance criteria:**

- CI fails on broken local links
- Examples use public exports
- External links do not make CI flaky

**Likely files:** `package.json`, `.github/workflows/ci.yml`, `examples`

**Tests:** Documentation check command runs locally and in CI

### 30. Add npm provenance release workflow

**Difficulty:** advanced · **Type:** release

**Context:** Release guidance calls for provenance but no publishing workflow is implemented.

**Scope/tasks:**

- Create a tag-triggered trusted-publishing workflow
- Gate publish on full validation
- Attach package metadata to the release

**Acceptance criteria:**

- Workflow uses OIDC and no long-lived npm token
- Dry runs are possible
- Environment approval is documented

**Likely files:** `.github/workflows/release.yml`, `CHANGELOG.md`, `SECURITY.md`

**Tests:** Workflow syntax validation and npm pack inspection

## Ecosystem adoption

### 31. Build a minimal React wallet hook example

**Difficulty:** beginner · **Type:** example

**Context:** Many Stellar dApps wrap Freighter in a hook and need a realistic testing pattern.

**Scope/tasks:**

- Create a tiny framework-isolated example
- Show rejection and account refresh tests
- Avoid shipping React in the package

**Acceptance criteria:**

- Example is under 200 source lines
- Dependencies are example-only
- Tests demonstrate public APIs

**Likely files:** `examples/react-wallet-hook`, `README.md`

**Tests:** Hook success, rejection, and account-change tests

### 32. Publish a wallet adapter interoperability guide

**Difficulty:** intermediate · **Type:** documentation

**Context:** DApps may support multiple Stellar wallets behind their own adapter.

**Scope/tasks:**

- Define the boundary between this mock and app adapters
- Show dependency injection patterns
- Document unsupported wallet-specific methods

**Acceptance criteria:**

- Guide avoids claiming universal wallet compatibility
- Two adapter patterns are shown
- Freighter-specific behavior is labeled

**Likely files:** `docs/INTEROPERABILITY.md`, `README.md`

**Tests:** Example adapters typecheck

### 33. Add JSON schema for scenario definitions

**Difficulty:** intermediate · **Type:** enhancement

**Context:** Serializable scenarios could be shared across language and browser harnesses.

**Scope/tasks:**

- Define a versioned JSON schema
- Separate serializable behavior from functions
- Add validation with useful paths

**Acceptance criteria:**

- Schema rejects unknown operations and invalid delays
- Versioning rules are documented
- No heavy validator is required at runtime

**Likely files:** `schema/scenario.schema.json`, `src/scenarios.ts`, `docs/SCENARIOS.md`

**Tests:** Valid presets and representative invalid documents

### 34. Create a test vector corpus for wallet implementers

**Difficulty:** advanced · **Type:** compatibility

**Context:** Wallet and dApp teams need shared, non-secret request and response fixtures.

**Scope/tasks:**

- Design versioned fixture metadata
- Add transaction and Soroban examples
- Document expected object results

**Acceptance criteria:**

- All addresses derive from public bytes only
- Fixtures have provenance and protocol versions
- Corpus is consumable outside Vitest

**Likely files:** `test-vectors`, `docs/INTEROPERABILITY.md`

**Tests:** Every fixture decodes and validates against its metadata

### 35. Add opt-in deterministic cryptographic test signer

**Difficulty:** advanced · **Type:** security

**Context:** Some integration tests need valid signatures while the safe default must remain explicitly fake.

**Scope/tasks:**

- Design an isolated signer entry point
- Use a published throwaway test vector
- Label and document every security boundary

**Acceptance criteria:**

- Core and default adapter never import the signer
- The key is unmistakably public test material
- Transaction, auth, and message verification tests pass

**Likely files:** `src/test-signer.ts`, `docs/SECURITY_MODEL.md`, `package.json`

**Tests:** Signature verification, isolation, tree-shaking, and misuse-warning tests

### 36. Create an adoption feedback template

**Difficulty:** beginner · **Type:** community

**Context:** The 1.0 criteria require feedback from real Stellar dApps.

**Scope/tasks:**

- Add a structured adoption issue form
- Ask about wallet versions and test layers
- Avoid collection of private application data

**Acceptance criteria:**

- Template captures actionable compatibility gaps
- Security-sensitive fields include warnings
- Responses map to roadmap decisions

**Likely files:** `.github/ISSUE_TEMPLATE/adoption.yml`, `docs/ROADMAP.md`

**Tests:** Issue-form YAML validation
