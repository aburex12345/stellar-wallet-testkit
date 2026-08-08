export { createFreighterMock } from "./adapter.js";
export { normalizeError, WalletController, WalletOperationError } from "./controller.js";
export { createFreighterModuleMock } from "./mock.js";
export { SCENARIO_NAMES, SECONDARY_ADDRESS, scenario } from "./scenarios.js";
export {
  assertInvokeContract,
  assertOperationCount,
  assertPayment,
  assertSource,
  assertTransactionNetwork,
  decodeEnvelope,
  InvalidTransactionXdrError,
} from "./xdr.js";
export {
  DEFAULT_ADDRESS,
  DEFAULT_STATE,
  type AddressResult,
  type AllowedResult,
  type ConnectedResult,
  type FreighterApiError,
  type FreighterMockApi,
  type NetworkResult,
  type ScriptedBehavior,
  type SignAuthEntryOptions,
  type SignAuthEntryResult,
  type SignMessageOptions,
  type SignMessageResult,
  type SignTransactionOptions,
  type SignTransactionResult,
  type WalletControllerOptions,
  type WalletEvent,
  type WalletListener,
  type WalletOperation,
  type WalletState,
  type WalletStatePatch,
} from "./types.js";
export type {
  DecodedEnvelope,
  PaymentExpectation,
  StellarOperation,
  StellarTransaction,
} from "./xdr.js";
