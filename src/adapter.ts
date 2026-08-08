import { WalletController, WalletOperationError } from "./controller.js";
import type {
  AddressResult,
  AllowedResult,
  ConnectedResult,
  FreighterApiError,
  FreighterMockApi,
  NetworkResult,
  SignAuthEntryOptions,
  SignAuthEntryResult,
  SignMessageOptions,
  SignMessageResult,
  SignTransactionOptions,
  SignTransactionResult,
  WalletOperation,
} from "./types.js";

const ERRORS = {
  missing: { code: "WALLET_NOT_INSTALLED", message: "Freighter is not installed." },
  disconnected: { code: "WALLET_NOT_CONNECTED", message: "Freighter is not connected." },
  denied: { code: "USER_DECLINED", message: "The user declined access." },
  account: { code: "ACCOUNT_MISMATCH", message: "The requested account is not active." },
  network: { code: "NETWORK_MISMATCH", message: "The requested network does not match." },
} as const satisfies Record<string, FreighterApiError>;

function encodeFakeSignature(input: string, address: string): string {
  const bytes = new TextEncoder().encode(`FAKE_TEST_SIGNATURE:${address}:${input}`);
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function createFreighterMock(controller = new WalletController()): FreighterMockApi {
  const execute = async <T>(
    operation: WalletOperation,
    fallback: () => T | Promise<T>,
    errorResult: (error: FreighterApiError) => T,
  ): Promise<T> => {
    try {
      return await controller.run(operation, fallback);
    } catch (error) {
      if (error instanceof WalletOperationError) {
        return errorResult({ code: error.code, message: error.message });
      }
      throw error;
    }
  };

  const unavailable = (): FreighterApiError | undefined => {
    if (!controller.state.installed) return ERRORS.missing;
    if (!controller.state.connected) return ERRORS.disconnected;
    return undefined;
  };

  const unauthorized = (): FreighterApiError | undefined =>
    unavailable() ?? (!controller.state.allowed ? ERRORS.denied : undefined);

  const validateSigningOptions = (
    options: SignTransactionOptions | SignAuthEntryOptions | SignMessageOptions = {},
  ): FreighterApiError | undefined => {
    const state = controller.state;
    const blocked = unauthorized();
    if (blocked) return blocked;
    if (options.address && options.address !== state.address) return ERRORS.account;
    if (
      ("network" in options && options.network && options.network !== state.network) ||
      (options.networkPassphrase && options.networkPassphrase !== state.networkPassphrase)
    ) {
      return ERRORS.network;
    }
    return undefined;
  };

  return {
    getAddress: () =>
      execute<AddressResult>(
        "getAddress",
        () => {
          const error = unauthorized();
          return error ? { address: "", error } : { address: controller.state.address };
        },
        (error) => ({ address: "", error }),
      ),
    getNetwork: () =>
      execute<NetworkResult>(
        "getNetwork",
        () => {
          const error = unavailable();
          return error
            ? { network: "", networkPassphrase: "", error }
            : {
                network: controller.state.network,
                networkPassphrase: controller.state.networkPassphrase,
              };
        },
        (error) => ({ network: "", networkPassphrase: "", error }),
      ),
    requestAccess: () =>
      execute<AddressResult>(
        "requestAccess",
        () => {
          const error = unavailable();
          if (error) return { address: "", error };
          if (!controller.state.allowed) return { address: "", error: ERRORS.denied };
          return { address: controller.state.address };
        },
        (error) => ({ address: "", error }),
      ),
    isConnected: () =>
      execute<ConnectedResult>(
        "isConnected",
        () => ({
          isConnected: controller.state.installed && controller.state.connected,
        }),
        (error) => ({ isConnected: false, error }),
      ),
    isAllowed: () =>
      execute<AllowedResult>(
        "isAllowed",
        () => ({
          isAllowed:
            controller.state.installed && controller.state.connected && controller.state.allowed,
        }),
        (error) => ({ isAllowed: false, error }),
      ),
    signTransaction: (transactionXdr, options = {}) =>
      execute<SignTransactionResult>(
        "signTransaction",
        () => {
          const error = validateSigningOptions(options);
          return error
            ? { signedTxXdr: "", signerAddress: "", error }
            : { signedTxXdr: transactionXdr, signerAddress: controller.state.address };
        },
        (error) => ({ signedTxXdr: "", signerAddress: "", error }),
      ),
    signAuthEntry: (authEntryXdr, options = {}) =>
      execute<SignAuthEntryResult>(
        "signAuthEntry",
        () => {
          const error = validateSigningOptions(options);
          return error
            ? { signedAuthEntry: "", signerAddress: "", error }
            : { signedAuthEntry: authEntryXdr, signerAddress: controller.state.address };
        },
        (error) => ({ signedAuthEntry: "", signerAddress: "", error }),
      ),
    signMessage: (message, options = {}) =>
      execute<SignMessageResult>(
        "signMessage",
        () => {
          const error = validateSigningOptions(options);
          return error
            ? { signedMessage: "", signerAddress: "", error }
            : {
                signedMessage: encodeFakeSignature(message, controller.state.address),
                signerAddress: controller.state.address,
              };
        },
        (error) => ({ signedMessage: "", signerAddress: "", error }),
      ),
  };
}
