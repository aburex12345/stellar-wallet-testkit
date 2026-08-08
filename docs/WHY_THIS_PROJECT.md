# Why This Project

Stellar dApps depend on wallet behavior that ordinary unit stubs rarely capture: installation,
connection, permission, network context, selected account, user rejection, and signing response
shape. Extension-driven end-to-end tests can cover these states, but they are slow, difficult to
seed, and fragile in CI.

Stellar Wallet Testkit provides a middle layer:

- more realistic than replacing `signTransaction` with one resolved promise;
- faster and more deterministic than automating an extension;
- focused on Stellar XDR, Soroban contract calls, and Freighter compatibility; and
- reusable across unit, integration, and browser tests.

The project does not seek to simulate wallet UI, custody, hardware signing, Horizon, or Soroban
RPC. Those are separate systems with different trust boundaries. It also does not apply Ethereum
provider discovery standards such as EIP-6963.

For the Stellar ecosystem, a shared test vocabulary improves both dApp quality and wallet
compatibility. A reproducible “user rejected on wrong network after account change” test is more
actionable than every project maintaining a different ad hoc mock.
