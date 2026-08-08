import { Networks } from "@stellar/stellar-sdk";

export const DEFAULT_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export interface WalletState {
  installed: boolean;
  connected: boolean;
  allowed: boolean;
  address: string;
  network: string;
  networkPassphrase: string;
}

export type WalletStatePatch = Partial<WalletState>;

export type WalletOperation =
  | "getAddress"
  | "getNetwork"
  | "requestAccess"
  | "isConnected"
  | "isAllowed"
  | "signTransaction"
  | "signAuthEntry"
  | "signMessage";

export interface FreighterApiError {
  code: string;
  message: string;
}

export interface ScriptedBehavior {
  operation: WalletOperation;
  delayMs?: number;
  timeout?: boolean;
  error?: FreighterApiError | string;
  result?: unknown;
  statePatch?: WalletStatePatch;
}

export interface WalletEvent {
  type: "stateChanged" | "operation";
  state: Readonly<WalletState>;
  operation?: WalletOperation;
  previousState?: Readonly<WalletState>;
}

export type WalletListener = (event: WalletEvent) => void;

export interface AddressResult {
  address: string;
  error?: FreighterApiError;
}

export interface NetworkResult {
  network: string;
  networkPassphrase: string;
  error?: FreighterApiError;
}

export interface ConnectedResult {
  isConnected: boolean;
  error?: FreighterApiError;
}

export interface AllowedResult {
  isAllowed: boolean;
  error?: FreighterApiError;
}

export interface SignTransactionOptions {
  network?: string;
  networkPassphrase?: string;
  address?: string;
}

export interface SignTransactionResult {
  signedTxXdr: string;
  signerAddress: string;
  error?: FreighterApiError;
}

export interface SignAuthEntryOptions {
  networkPassphrase?: string;
  address?: string;
}

export interface SignAuthEntryResult {
  signedAuthEntry: string;
  signerAddress: string;
  error?: FreighterApiError;
}

export interface SignMessageOptions {
  networkPassphrase?: string;
  address?: string;
}

export interface SignMessageResult {
  signedMessage: string;
  signerAddress: string;
  error?: FreighterApiError;
}

export interface FreighterMockApi {
  getAddress(): Promise<AddressResult>;
  getNetwork(): Promise<NetworkResult>;
  requestAccess(): Promise<AddressResult>;
  isConnected(): Promise<ConnectedResult>;
  isAllowed(): Promise<AllowedResult>;
  signTransaction(
    transactionXdr: string,
    options?: SignTransactionOptions,
  ): Promise<SignTransactionResult>;
  signAuthEntry(authEntryXdr: string, options?: SignAuthEntryOptions): Promise<SignAuthEntryResult>;
  signMessage(message: string, options?: SignMessageOptions): Promise<SignMessageResult>;
}

export interface WalletControllerOptions extends WalletStatePatch {
  scripts?: readonly ScriptedBehavior[];
}

export const DEFAULT_STATE: Readonly<WalletState> = Object.freeze({
  installed: true,
  connected: true,
  allowed: true,
  address: DEFAULT_ADDRESS,
  network: "TESTNET",
  networkPassphrase: Networks.TESTNET,
});
