import {
  DEFAULT_STATE,
  type FreighterApiError,
  type ScriptedBehavior,
  type WalletControllerOptions,
  type WalletEvent,
  type WalletListener,
  type WalletOperation,
  type WalletState,
  type WalletStatePatch,
} from "./types.js";

const clone = (state: WalletState): Readonly<WalletState> => Object.freeze({ ...state });

export class WalletController {
  readonly #listeners = new Set<WalletListener>();
  readonly #scripts = new Map<WalletOperation, ScriptedBehavior[]>();
  readonly #history: WalletOperation[] = [];
  #state: WalletState;

  constructor(options: WalletControllerOptions = {}) {
    const { scripts = [], ...state } = options;
    this.#state = { ...DEFAULT_STATE, ...state };
    for (const behavior of scripts) this.enqueue(behavior);
  }

  get state(): Readonly<WalletState> {
    return clone(this.#state);
  }

  get history(): readonly WalletOperation[] {
    return [...this.#history];
  }

  setState(patch: WalletStatePatch): Readonly<WalletState> {
    const previousState = clone(this.#state);
    this.#state = { ...this.#state, ...patch };
    this.#emit({ type: "stateChanged", state: this.state, previousState });
    return this.state;
  }

  install(): void {
    this.setState({ installed: true });
  }

  uninstall(): void {
    this.setState({ installed: false, connected: false, allowed: false });
  }

  connect(): void {
    this.setState({ installed: true, connected: true });
  }

  disconnect(): void {
    this.setState({ connected: false, allowed: false });
  }

  allow(): void {
    this.setState({ installed: true, connected: true, allowed: true });
  }

  deny(): void {
    this.setState({ allowed: false });
  }

  changeAccount(address: string): void {
    this.setState({ address });
  }

  changeNetwork(network: string, networkPassphrase: string): void {
    this.setState({ network, networkPassphrase });
  }

  enqueue(behavior: ScriptedBehavior): this {
    const queue = this.#scripts.get(behavior.operation) ?? [];
    queue.push({ ...behavior });
    this.#scripts.set(behavior.operation, queue);
    return this;
  }

  clearScripts(operation?: WalletOperation): void {
    if (operation) this.#scripts.delete(operation);
    else this.#scripts.clear();
  }

  clearHistory(): void {
    this.#history.length = 0;
  }

  subscribe(listener: WalletListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async run<T>(operation: WalletOperation, fallback: () => T | Promise<T>): Promise<T> {
    this.#history.push(operation);
    this.#emit({ type: "operation", operation, state: this.state });
    const behavior = this.#scripts.get(operation)?.shift();

    if (behavior?.statePatch) this.setState(behavior.statePatch);
    if (behavior?.delayMs !== undefined) {
      await new Promise<void>((resolve) => setTimeout(resolve, behavior.delayMs));
    }
    if (behavior?.timeout) return await new Promise<T>(() => undefined);
    if (behavior?.error) throw normalizeError(behavior.error);
    if (behavior && "result" in behavior) return behavior.result as T;
    return await fallback();
  }

  #emit(event: WalletEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

export class WalletOperationError extends Error {
  readonly code: string;

  constructor(error: FreighterApiError) {
    super(error.message);
    this.name = "WalletOperationError";
    this.code = error.code;
  }
}

export function normalizeError(error: FreighterApiError | string): WalletOperationError {
  return new WalletOperationError(
    typeof error === "string" ? { code: "INTERNAL_ERROR", message: error } : error,
  );
}
