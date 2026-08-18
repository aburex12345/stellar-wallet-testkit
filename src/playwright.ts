import { DEFAULT_STATE } from "./types.js";
import type {
  FreighterMockApi,
  ScriptedBehavior,
  WalletControllerOptions,
  WalletOperation,
  WalletState,
  WalletStatePatch,
} from "./types.js";

export interface InitScriptPage {
  addInitScript<Argument>(
    script: (argument: Argument) => unknown,
    argument: Argument,
  ): Promise<void>;
}

export interface BrowserWalletControl {
  getState(): WalletState;
  setState(patch: WalletStatePatch): WalletState;
  enqueue(behavior: ScriptedBehavior): void;
  clearScripts(): void;
  history(): readonly WalletOperation[];
}

export interface WalletPageFixture {
  page: InitScriptPage;
}

export async function installFreighterMock(
  page: InitScriptPage,
  options: WalletControllerOptions = {},
): Promise<void> {
  const { scripts = [], ...patch } = options;
  for (const behavior of scripts) {
    if (
      behavior.delayMs !== undefined &&
      (!Number.isFinite(behavior.delayMs) || behavior.delayMs < 0)
    ) {
      throw new RangeError("delayMs must be a non-negative finite number");
    }
  }
  await page.addInitScript(
    (configuration: { state: WalletState; scripts: ScriptedBehavior[] }) => {
      const state = configuration.state;
      const queues = new Map<string, ScriptedBehavior[]>();
      const calls: WalletOperation[] = [];
      for (const item of configuration.scripts) {
        const queue = queues.get(item.operation) ?? [];
        queue.push(item);
        queues.set(item.operation, queue);
      }

      const error = (code: string, message: string) => ({ code, message });
      const unavailable = () =>
        !state.installed
          ? error("WALLET_NOT_INSTALLED", "Freighter is not installed.")
          : !state.connected
            ? error("WALLET_NOT_CONNECTED", "Freighter is not connected.")
            : undefined;
      const unauthorized = () =>
        unavailable() ??
        (!state.allowed ? error("USER_DECLINED", "The user declined access.") : undefined);
      const run = async <T>(operation: WalletOperation, fallback: () => T): Promise<T> => {
        calls.push(operation);
        const behavior = queues.get(operation)?.shift();
        if (behavior?.statePatch) Object.assign(state, behavior.statePatch);
        if (behavior?.delayMs !== undefined) {
          await new Promise<void>((resolve) => setTimeout(resolve, behavior.delayMs));
        }
        if (behavior?.timeout) return await new Promise<T>(() => undefined);
        if (behavior?.error) {
          const scripted =
            typeof behavior.error === "string"
              ? error("INTERNAL_ERROR", behavior.error)
              : behavior.error;
          return { error: scripted } as T;
        }
        if (behavior && "result" in behavior) return behavior.result as T;
        return fallback();
      };
      const signingError = (
        options: { network?: string; networkPassphrase?: string; address?: string } = {},
      ) => {
        const blocked = unauthorized();
        if (blocked) return blocked;
        if (options.address && options.address !== state.address) {
          return error("ACCOUNT_MISMATCH", "The requested account is not active.");
        }
        if (
          (options.network && options.network !== state.network) ||
          (options.networkPassphrase && options.networkPassphrase !== state.networkPassphrase)
        ) {
          return error("NETWORK_MISMATCH", "The requested network does not match.");
        }
        return undefined;
      };

      const api: FreighterMockApi = {
        getAddress: () =>
          run("getAddress", () => {
            const blocked = unauthorized();
            return blocked ? { address: "", error: blocked } : { address: state.address };
          }),
        getNetwork: () =>
          run("getNetwork", () => {
            const blocked = unavailable();
            return blocked
              ? { network: "", networkPassphrase: "", error: blocked }
              : { network: state.network, networkPassphrase: state.networkPassphrase };
          }),
        requestAccess: () =>
          run("requestAccess", () => {
            const blocked = unauthorized();
            return blocked ? { address: "", error: blocked } : { address: state.address };
          }),
        isConnected: () =>
          run("isConnected", () => ({
            isConnected: state.installed && state.connected,
          })),
        isAllowed: () =>
          run("isAllowed", () => ({
            isAllowed: state.installed && state.connected && state.allowed,
          })),
        signTransaction: (transactionXdr, options = {}) =>
          run("signTransaction", () => {
            const blocked = signingError(options);
            return blocked
              ? { signedTxXdr: "", signerAddress: "", error: blocked }
              : { signedTxXdr: transactionXdr, signerAddress: state.address };
          }),
        signAuthEntry: (authEntryXdr, options = {}) =>
          run("signAuthEntry", () => {
            const blocked = signingError(options);
            return blocked
              ? { signedAuthEntry: "", signerAddress: "", error: blocked }
              : { signedAuthEntry: authEntryXdr, signerAddress: state.address };
          }),
        signMessage: (message, options = {}) =>
          run("signMessage", () => {
            const blocked = signingError(options);
            const bytes = new TextEncoder().encode(
              `FAKE_TEST_SIGNATURE:${state.address}:${message}`,
            );
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return blocked
              ? { signedMessage: "", signerAddress: "", error: blocked }
              : {
                  signedMessage: btoa(binary),
                  signerAddress: state.address,
                };
          }),
      };
      const control: BrowserWalletControl = {
        getState: () => ({ ...state }),
        setState: (next) => Object.assign(state, next),
        enqueue: (behavior) => {
          if (
            behavior.delayMs !== undefined &&
            (!Number.isFinite(behavior.delayMs) || behavior.delayMs < 0)
          ) {
            throw new RangeError("delayMs must be a non-negative finite number");
          }
          const queue = queues.get(behavior.operation) ?? [];
          queue.push(behavior);
          queues.set(behavior.operation, queue);
        },
        clearScripts: () => queues.clear(),
        history: () => [...calls],
      };
      Object.defineProperty(window, "freighterApi", { configurable: true, value: api });
      Object.defineProperty(window, "__stellarWalletTestkit", {
        configurable: true,
        value: control,
      });
    },
    { state: { ...DEFAULT_STATE, ...patch }, scripts: scripts.map((item) => ({ ...item })) },
  );
}

/**
 * Returns a Playwright-compatible fixture function without importing
 * `@playwright/test`. Pass it to `base.extend({ wallet: walletFixture(...) })`.
 */
export function walletFixture(options: WalletControllerOptions = {}) {
  return async (
    { page }: WalletPageFixture,
    use: (controlName: "__stellarWalletTestkit") => Promise<void>,
  ): Promise<void> => {
    await installFreighterMock(page, options);
    await use("__stellarWalletTestkit");
  };
}

declare global {
  interface Window {
    freighterApi: FreighterMockApi;
    __stellarWalletTestkit: BrowserWalletControl;
  }
}
