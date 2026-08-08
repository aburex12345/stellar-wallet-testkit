# Architecture

## Design goals

The package is deterministic, offline, runner-neutral, browser-injectable, and explicit about fake
signing. Public APIs use small typed interfaces instead of importing test frameworks.

## Components

1. `WalletController` owns installed, connected, allowed, account, and network state. It queues
   one-shot behaviors by operation and emits generic state/operation events.
2. `createFreighterMock` maps controller state to Freighter-compatible object results. Scripted
   exceptions become `{ error: { code, message } }`.
3. `createFreighterModuleMock` adds named/default export shapes without importing Vitest or Jest.
4. `installFreighterMock` serializes configuration into a browser init script. Its control channel
   exists for tests and is not presented as a Freighter API.
5. XDR utilities delegate parsing to `@stellar/stellar-sdk`, normalize malformed-input errors, and
   assert typed operation details.
6. Scenario presets are fresh controller options, avoiding shared mutable state.

## Dependency boundaries

`@stellar/stellar-sdk` is the only runtime dependency. Playwright, Vitest, and Jest remain peerless
consumer choices. Core modules do not access the network or filesystem.

## Data flow

Application call → mock adapter → controller script queue → state-derived fallback → Freighter
object result. Browser injection mirrors this flow inside the page because functions and class
instances cannot cross Playwright's serialization boundary.

## Compatibility

The adapter follows the current object-result API rather than deprecated primitive-return methods.
Compatibility tests should pin observed shapes from supported Freighter releases. The generic
controller subscription is intentionally separate because the emulated Freighter surface does not
promise account/network event subscriptions.
