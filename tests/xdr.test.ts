import {
  Account,
  Asset,
  Contract,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  assertInvokeContract,
  assertOperationCount,
  assertPayment,
  assertSource,
  assertTransactionNetwork,
  decodeEnvelope,
  DEFAULT_ADDRESS,
  InvalidTransactionXdrError,
} from "../src/index.js";

const destination = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
const issuer = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
const contractId = StrKey.encodeContract(Buffer.alloc(32, 3));

function paymentXdr(
  operation = Operation.payment({ destination, amount: "12.5000000", asset: Asset.native() }),
): string {
  return new TransactionBuilder(new Account(DEFAULT_ADDRESS, "1"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(0)
    .build()
    .toXDR();
}

describe("transaction XDR utilities", () => {
  it("decodes a transaction envelope", () => {
    expect(decodeEnvelope(paymentXdr(), Networks.TESTNET).source).toBe(DEFAULT_ADDRESS);
  });

  it("retains the supplied network context", () => {
    expect(decodeEnvelope(paymentXdr(), Networks.TESTNET).networkPassphrase).toBe(Networks.TESTNET);
  });

  it("identifies ordinary envelopes", () => {
    expect(decodeEnvelope(paymentXdr(), Networks.TESTNET).feeBump).toBe(false);
  });

  it("rejects empty XDR", () => {
    expect(() => decodeEnvelope("", Networks.TESTNET)).toThrow(InvalidTransactionXdrError);
  });

  it("trims envelope input before decoding", () => {
    expect(decodeEnvelope(`  ${paymentXdr()}  `, Networks.TESTNET).source).toBe(DEFAULT_ADDRESS);
  });

  it("attaches the parse cause to malformed XDR errors", () => {
    try {
      decodeEnvelope("not-xdr", Networks.TESTNET);
      throw new Error("expected decodeEnvelope to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransactionXdrError);
      expect((error as InvalidTransactionXdrError).cause).toBeInstanceOf(Error);
    }
  });

  it("rejects malformed base64", () => {
    expect(() => decodeEnvelope("not-xdr", Networks.TESTNET)).toThrow("Invalid transaction XDR");
  });

  it("asserts source accounts", () => {
    expect(() =>
      assertSource(decodeEnvelope(paymentXdr(), Networks.TESTNET), DEFAULT_ADDRESS),
    ).not.toThrow();
  });

  it("reports source mismatches", () => {
    expect(() => assertSource(decodeEnvelope(paymentXdr(), Networks.TESTNET), destination)).toThrow(
      "Expected source",
    );
  });

  it("asserts operation count", () => {
    expect(() =>
      assertOperationCount(decodeEnvelope(paymentXdr(), Networks.TESTNET), 1),
    ).not.toThrow();
  });

  it("reports operation count mismatches", () => {
    expect(() => assertOperationCount(decodeEnvelope(paymentXdr(), Networks.TESTNET), 2)).toThrow(
      "received 1",
    );
  });

  it("rejects invalid expected counts", () => {
    expect(() => assertOperationCount(decodeEnvelope(paymentXdr(), Networks.TESTNET), -1)).toThrow(
      TypeError,
    );
  });

  it("asserts native payments", () => {
    const operation = assertPayment(decodeEnvelope(paymentXdr(), Networks.TESTNET), {
      destination,
      amount: "12.5000000",
      asset: Asset.native(),
    });
    expect(operation.type).toBe("payment");
  });

  it("asserts credit asset payments", () => {
    const asset = new Asset("USDC", issuer);
    const decoded = decodeEnvelope(
      paymentXdr(Operation.payment({ destination, amount: "2.0000000", asset })),
      Networks.TESTNET,
    );
    expect(() => assertPayment(decoded, { asset, amount: "2.0000000" })).not.toThrow();
  });

  it("reports payment field mismatches", () => {
    const decoded = decodeEnvelope(paymentXdr(), Networks.TESTNET);
    expect(() => assertPayment(decoded, { destination: DEFAULT_ADDRESS })).toThrow(
      "payment destination",
    );
    expect(() => assertPayment(decoded, { amount: "1.0000000" })).toThrow("payment amount");
  });

  it("rejects a missing payment index", () => {
    expect(() => assertPayment(decodeEnvelope(paymentXdr(), Networks.TESTNET), {}, 2)).toThrow(
      "No operation",
    );
  });

  it("rejects a negative payment index", () => {
    expect(() => assertPayment(decodeEnvelope(paymentXdr(), Networks.TESTNET), {}, -1)).toThrow(
      TypeError,
    );
  });

  it("distinguishes non-payment operations", () => {
    const xdr = paymentXdr(Operation.manageData({ name: "test", value: "value" }));
    expect(() => assertPayment(decodeEnvelope(xdr, Networks.TESTNET), {})).toThrow(
      'received "manageData"',
    );
  });

  it("asserts the caller-provided network context", () => {
    expect(assertTransactionNetwork(paymentXdr(), Networks.TESTNET, Networks.TESTNET).source).toBe(
      DEFAULT_ADDRESS,
    );
  });

  it("reports network context mismatches", () => {
    expect(() => assertTransactionNetwork(paymentXdr(), Networks.PUBLIC, Networks.TESTNET)).toThrow(
      "Expected network passphrase",
    );
  });

  it("asserts contract invocation targets", () => {
    const operation = new Contract(contractId).call("hello");
    const transactionXdr = paymentXdr(operation);
    expect(
      assertInvokeContract(decodeEnvelope(transactionXdr, Networks.TESTNET), contractId).type,
    ).toBe("invokeHostFunction");
  });

  it("reports contract target mismatches", () => {
    const transactionXdr = paymentXdr(new Contract(contractId).call("hello"));
    const other = StrKey.encodeContract(Buffer.alloc(32, 4));
    expect(() =>
      assertInvokeContract(decodeEnvelope(transactionXdr, Networks.TESTNET), other),
    ).toThrow("Expected contract");
  });
});
