import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  createFreighterMock,
  createFreighterModuleMock,
  DEFAULT_ADDRESS,
  SCENARIO_NAMES,
  SECONDARY_ADDRESS,
  scenario,
  WalletController,
} from "../src/index.js";

describe("scenario presets", () => {
  it("exports every documented preset", () => {
    expect(SCENARIO_NAMES).toHaveLength(7);
  });

  it("rejects unknown scenario names at runtime", () => {
    expect(() => scenario("not-a-scenario" as never)).toThrow(/Unknown scenario/);
  });

  it("models user rejection", async () => {
    const result = await createFreighterMock(
      new WalletController(scenario("user-rejection")),
    ).requestAccess();
    expect(result.error?.code).toBe("USER_DECLINED");
  });

  it("models a missing wallet", async () => {
    const result = await createFreighterMock(
      new WalletController(scenario("wallet-missing")),
    ).isConnected();
    expect(result.isConnected).toBe(false);
  });

  it("models a wrong network", async () => {
    const result = await createFreighterMock(
      new WalletController(scenario("wrong-network")),
    ).getNetwork();
    expect(result.networkPassphrase).toBe(Networks.PUBLIC);
  });

  it("models account changes at the next address read", async () => {
    const result = await createFreighterMock(
      new WalletController(scenario("account-changed")),
    ).getAddress();
    expect(result.address).toBe(SECONDARY_ADDRESS);
  });

  it("models malformed signature responses", async () => {
    const result = await createFreighterMock(
      new WalletController(scenario("malformed-signature-response")),
    ).signTransaction("valid-looking-input");
    expect(result.signedTxXdr).toBe("not-xdr");
  });

  it("models signing failures", async () => {
    const result = await createFreighterMock(
      new WalletController(scenario("signing-failure")),
    ).signTransaction("AAAA");
    expect(result.error?.code).toBe("SIGNING_FAILED");
  });
});

describe("runner-independent module mock", () => {
  it("provides named and default APIs", async () => {
    const module = createFreighterModuleMock();
    expect((await module.default.getAddress()).address).toBe(DEFAULT_ADDRESS);
    expect((await module.getAddress()).address).toBe(DEFAULT_ADDRESS);
  });

  it("accepts an existing controller", async () => {
    const controller = new WalletController({ allowed: false });
    const module = createFreighterModuleMock(controller);
    expect(module.__controller).toBe(controller);
    expect((await module.isAllowed()).isAllowed).toBe(false);
  });
});
