import { afterEach, describe, expect, it } from "vitest";
import { installFreighterMock, walletFixture } from "../src/playwright.js";
import { DEFAULT_ADDRESS } from "../src/types.js";

class FakePage {
  async addInitScript<Argument>(
    script: (argument: Argument) => unknown,
    argument: Argument,
  ): Promise<void> {
    await script(argument);
  }
}

describe("browser injection", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  function browser(): Window {
    const value = {} as Window;
    Object.defineProperty(globalThis, "window", { configurable: true, value });
    return value;
  }

  it("injects the Freighter API before app code", async () => {
    const target = browser();
    await installFreighterMock(new FakePage());
    expect((await target.freighterApi.getAddress()).address).toBe(DEFAULT_ADDRESS);
  });

  it("injects a runtime control channel", async () => {
    const target = browser();
    await installFreighterMock(new FakePage());
    target.__stellarWalletTestkit.setState({ allowed: false });
    expect((await target.freighterApi.isAllowed()).isAllowed).toBe(false);
  });

  it("supports browser-side scripted responses", async () => {
    const target = browser();
    await installFreighterMock(new FakePage(), {
      scripts: [{ operation: "getAddress", result: { address: "scripted" } }],
    });
    expect((await target.freighterApi.getAddress()).address).toBe("scripted");
  });

  it("tracks browser-side operation history", async () => {
    const target = browser();
    await installFreighterMock(new FakePage());
    await target.freighterApi.isConnected();
    await target.freighterApi.getNetwork();
    expect(target.__stellarWalletTestkit.history()).toEqual(["isConnected", "getNetwork"]);
  });

  it("returns browser object errors for a missing wallet", async () => {
    const target = browser();
    await installFreighterMock(new FakePage(), {
      installed: false,
      connected: false,
      allowed: false,
    });
    expect((await target.freighterApi.getAddress()).error?.code).toBe("WALLET_NOT_INSTALLED");
  });

  it("validates browser signing network options", async () => {
    const target = browser();
    await installFreighterMock(new FakePage());
    const result = await target.freighterApi.signTransaction("AAAA", { network: "PUBLIC" });
    expect(result.error?.code).toBe("NETWORK_MISMATCH");
  });

  it("signs non-ASCII messages with deterministic fake bytes", async () => {
    const target = browser();
    await installFreighterMock(new FakePage());
    const result = await target.freighterApi.signMessage("你好 🌟");
    expect(Buffer.from(result.signedMessage, "base64").toString()).toContain("你好 🌟");
  });

  it("can clear queued browser scripts", async () => {
    const target = browser();
    await installFreighterMock(new FakePage(), {
      scripts: [{ operation: "getAddress", result: { address: "scripted" } }],
    });
    target.__stellarWalletTestkit.clearScripts();
    expect((await target.freighterApi.getAddress()).address).toBe(DEFAULT_ADDRESS);
  });

  it("rejects negative browser script delays", async () => {
    await expect(
      installFreighterMock(new FakePage(), {
        scripts: [{ operation: "isConnected", delayMs: -1 }],
      }),
    ).rejects.toThrow(RangeError);
  });

  it("provides a Playwright-compatible fixture function", async () => {
    browser();
    let fixtureValue = "";
    await walletFixture()({ page: new FakePage() }, (value) => {
      fixtureValue = value;
      return Promise.resolve();
    });
    expect(fixtureValue).toBe("__stellarWalletTestkit");
  });
});
