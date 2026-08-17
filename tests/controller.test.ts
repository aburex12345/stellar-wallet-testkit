import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  createFreighterMock,
  DEFAULT_ADDRESS,
  SECONDARY_ADDRESS,
  type WalletEvent,
  WalletController,
} from "../src/index.js";

describe("WalletController", () => {
  it("starts with a usable deterministic state", () => {
    const controller = new WalletController();
    expect(controller.state).toMatchObject({
      installed: true,
      connected: true,
      allowed: true,
      address: DEFAULT_ADDRESS,
      network: "TESTNET",
    });
  });

  it("accepts initial state overrides", () => {
    expect(new WalletController({ connected: false }).state.connected).toBe(false);
  });

  it("returns immutable snapshots", () => {
    expect(Object.isFrozen(new WalletController().state)).toBe(true);
  });

  it("installs without changing the account", () => {
    const controller = new WalletController({ installed: false });
    controller.install();
    expect(controller.state).toMatchObject({ installed: true, address: DEFAULT_ADDRESS });
  });

  it("uninstalling clears connection and permission", () => {
    const controller = new WalletController();
    controller.uninstall();
    expect(controller.state).toMatchObject({ installed: false, connected: false, allowed: false });
  });

  it("connecting marks the wallet installed", () => {
    const controller = new WalletController({ installed: false, connected: false });
    controller.connect();
    expect(controller.state).toMatchObject({ installed: true, connected: true });
  });

  it("disconnecting revokes permission", () => {
    const controller = new WalletController();
    controller.disconnect();
    expect(controller.state).toMatchObject({ connected: false, allowed: false });
  });

  it("allowing establishes all prerequisites", () => {
    const controller = new WalletController({ installed: false, connected: false, allowed: false });
    controller.allow();
    expect(controller.state).toMatchObject({ installed: true, connected: true, allowed: true });
  });

  it("changes accounts deterministically", () => {
    const controller = new WalletController();
    controller.changeAccount(SECONDARY_ADDRESS);
    expect(controller.state.address).toBe(SECONDARY_ADDRESS);
  });

  it("rejects a blank account address", () => {
    expect(() => new WalletController().changeAccount("  ")).toThrow(RangeError);
  });

  it("changes network name and passphrase together", () => {
    const controller = new WalletController();
    controller.changeNetwork("PUBLIC", Networks.PUBLIC);
    expect(controller.state).toMatchObject({
      network: "PUBLIC",
      networkPassphrase: Networks.PUBLIC,
    });
  });

  it("notifies subscribers and supports unsubscribe", () => {
    const controller = new WalletController();
    const events: WalletEvent[] = [];
    const unsubscribe = controller.subscribe((event) => events.push(event));
    controller.deny();
    unsubscribe();
    controller.allow();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("stateChanged");
  });

  it("records operations in order", async () => {
    const controller = new WalletController();
    const api = createFreighterMock(controller);
    await api.isConnected();
    await api.getAddress();
    expect(controller.history).toEqual(["isConnected", "getAddress"]);
  });

  it("clears operation history", async () => {
    const controller = new WalletController();
    await createFreighterMock(controller).getAddress();
    controller.clearHistory();
    expect(controller.history).toEqual([]);
  });

  it("consumes scripted results once", async () => {
    const controller = new WalletController({
      scripts: [{ operation: "getAddress", result: { address: SECONDARY_ADDRESS } }],
    });
    const api = createFreighterMock(controller);
    expect((await api.getAddress()).address).toBe(SECONDARY_ADDRESS);
    expect((await api.getAddress()).address).toBe(DEFAULT_ADDRESS);
  });

  it("applies scripted state changes before results", async () => {
    const controller = new WalletController({
      scripts: [{ operation: "getAddress", statePatch: { address: SECONDARY_ADDRESS } }],
    });
    expect((await createFreighterMock(controller).getAddress()).address).toBe(SECONDARY_ADDRESS);
  });

  it("rejects negative script delays", () => {
    expect(
      () => new WalletController({ scripts: [{ operation: "isConnected", delayMs: -1 }] }),
    ).toThrow(RangeError);
  });

  it("supports delayed operations", async () => {
    vi.useFakeTimers();
    const api = createFreighterMock(
      new WalletController({ scripts: [{ operation: "isConnected", delayMs: 50 }] }),
    );
    const pending = api.isConnected();
    await vi.advanceTimersByTimeAsync(49);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ isConnected: true });
    vi.useRealTimers();
  });

  it("models timeouts as pending operations", async () => {
    const api = createFreighterMock(
      new WalletController({ scripts: [{ operation: "requestAccess", timeout: true }] }),
    );
    const outcome = await Promise.race([
      api.requestAccess().then(() => "settled"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 5)),
    ]);
    expect(outcome).toBe("timeout");
  });

  it("clears scripts for a selected operation", async () => {
    const controller = new WalletController({
      scripts: [{ operation: "getAddress", result: { address: SECONDARY_ADDRESS } }],
    });
    controller.clearScripts("getAddress");
    expect((await createFreighterMock(controller).getAddress()).address).toBe(DEFAULT_ADDRESS);
  });
});

describe("Freighter-compatible adapter", () => {
  it("gets the active address", async () => {
    await expect(createFreighterMock().getAddress()).resolves.toEqual({ address: DEFAULT_ADDRESS });
  });

  it("gets network details", async () => {
    await expect(createFreighterMock().getNetwork()).resolves.toEqual({
      network: "TESTNET",
      networkPassphrase: Networks.TESTNET,
    });
  });

  it("reports connected state", async () => {
    const api = createFreighterMock(new WalletController({ connected: false }));
    await expect(api.isConnected()).resolves.toEqual({ isConnected: false });
  });

  it("reports allowed state", async () => {
    const api = createFreighterMock(new WalletController({ allowed: false }));
    await expect(api.isAllowed()).resolves.toEqual({ isAllowed: false });
  });

  it("returns an object error when wallet is missing", async () => {
    const result = await createFreighterMock(
      new WalletController({ installed: false, connected: false }),
    ).getAddress();
    expect(result.error?.code).toBe("WALLET_NOT_INSTALLED");
    expect(result.address).toBe("");
  });

  it("returns an object error when disconnected", async () => {
    const result = await createFreighterMock(
      new WalletController({ connected: false }),
    ).requestAccess();
    expect(result.error?.code).toBe("WALLET_NOT_CONNECTED");
  });

  it("returns an object error when access is denied", async () => {
    const result = await createFreighterMock(new WalletController({ allowed: false })).getAddress();
    expect(result.error?.code).toBe("USER_DECLINED");
  });

  it("passes transaction XDR through as an explicitly fake signature", async () => {
    const result = await createFreighterMock().signTransaction("AAAA");
    expect(result).toEqual({ signedTxXdr: "AAAA", signerAddress: DEFAULT_ADDRESS });
  });

  it("rejects an account mismatch", async () => {
    const result = await createFreighterMock().signTransaction("AAAA", {
      address: SECONDARY_ADDRESS,
    });
    expect(result.error?.code).toBe("ACCOUNT_MISMATCH");
  });

  it("rejects a network name mismatch", async () => {
    const result = await createFreighterMock().signTransaction("AAAA", { network: "PUBLIC" });
    expect(result.error?.code).toBe("NETWORK_MISMATCH");
  });

  it("rejects a network passphrase mismatch", async () => {
    const result = await createFreighterMock().signAuthEntry("AAAA", {
      networkPassphrase: Networks.PUBLIC,
    });
    expect(result.error?.code).toBe("NETWORK_MISMATCH");
  });

  it("passes auth entry XDR through as explicitly unsigned test data", async () => {
    const result = await createFreighterMock().signAuthEntry("AAAA");
    expect(result).toEqual({ signedAuthEntry: "AAAA", signerAddress: DEFAULT_ADDRESS });
  });

  it("produces a deterministic fake message signature", async () => {
    const api = createFreighterMock();
    expect((await api.signMessage("hello")).signedMessage).toBe(
      (await api.signMessage("hello")).signedMessage,
    );
  });

  it("does not confuse the fake signature with a real signature", async () => {
    const result = await createFreighterMock().signMessage("hello");
    expect(Buffer.from(result.signedMessage, "base64").toString()).toContain("FAKE_TEST_SIGNATURE");
  });

  it("maps scripted errors into Freighter result errors", async () => {
    const api = createFreighterMock(
      new WalletController({
        scripts: [{ operation: "signTransaction", error: "boom" }],
      }),
    );
    expect((await api.signTransaction("AAAA")).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "boom",
    });
  });
});
