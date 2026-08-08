import {
  Asset,
  FeeBumpTransaction,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

export type StellarTransaction = Transaction | FeeBumpTransaction;
export type StellarOperation = Transaction["operations"][number];

export interface DecodedEnvelope {
  transaction: StellarTransaction;
  innerTransaction: Transaction;
  source: string;
  operations: readonly StellarOperation[];
  networkPassphrase: string;
  feeBump: boolean;
}

export interface PaymentExpectation {
  destination?: string;
  amount?: string;
  asset?: Asset;
  source?: string;
}

export class InvalidTransactionXdrError extends Error {
  constructor(message = "Malformed or unsupported Stellar transaction XDR.") {
    super(message);
    this.name = "InvalidTransactionXdrError";
  }
}

export function decodeEnvelope(xdrValue: string, networkPassphrase: string): DecodedEnvelope {
  if (!xdrValue.trim()) throw new InvalidTransactionXdrError("Transaction XDR must not be empty.");
  try {
    const transaction = TransactionBuilder.fromXDR(xdrValue, networkPassphrase);
    const feeBump = transaction instanceof FeeBumpTransaction;
    const innerTransaction = feeBump ? transaction.innerTransaction : transaction;
    return {
      transaction,
      innerTransaction,
      source: innerTransaction.source,
      operations: innerTransaction.operations,
      networkPassphrase,
      feeBump,
    };
  } catch (cause) {
    throw new InvalidTransactionXdrError(
      cause instanceof Error ? `Invalid transaction XDR: ${cause.message}` : undefined,
    );
  }
}

export function assertTransactionNetwork(
  xdrValue: string,
  actualNetworkPassphrase: string,
  expectedNetworkPassphrase: string,
): DecodedEnvelope {
  const decoded = decodeEnvelope(xdrValue, actualNetworkPassphrase);
  if (actualNetworkPassphrase !== expectedNetworkPassphrase) {
    throw new Error(
      `Expected network passphrase "${expectedNetworkPassphrase}", received "${actualNetworkPassphrase}".`,
    );
  }
  return decoded;
}

export function assertSource(decoded: DecodedEnvelope, expectedSource: string): void {
  if (decoded.source !== expectedSource) {
    throw new Error(`Expected source "${expectedSource}", received "${decoded.source}".`);
  }
}

export function assertOperationCount(decoded: DecodedEnvelope, expectedCount: number): void {
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
    throw new TypeError("Expected operation count must be a non-negative safe integer.");
  }
  if (decoded.operations.length !== expectedCount) {
    throw new Error(
      `Expected ${String(expectedCount)} operation(s), received ${String(decoded.operations.length)}.`,
    );
  }
}

export function assertPayment(
  decoded: DecodedEnvelope,
  expected: PaymentExpectation,
  operationIndex = 0,
): Extract<StellarOperation, { type: "payment" }> {
  const operation = decoded.operations[operationIndex];
  if (!operation) throw new Error(`No operation exists at index ${String(operationIndex)}.`);
  if (operation.type !== "payment") {
    throw new Error(
      `Expected payment at index ${String(operationIndex)}, received "${operation.type}".`,
    );
  }
  if (expected.destination && operation.destination !== expected.destination) {
    throw new Error(
      `Expected payment destination "${expected.destination}", received "${operation.destination}".`,
    );
  }
  if (expected.amount && operation.amount !== expected.amount) {
    throw new Error(
      `Expected payment amount "${expected.amount}", received "${operation.amount}".`,
    );
  }
  if (expected.asset && !operation.asset.equals(expected.asset)) {
    throw new Error(
      `Expected payment asset "${expected.asset.toString()}", received "${operation.asset.toString()}".`,
    );
  }
  if (expected.source && operation.source !== expected.source) {
    throw new Error(
      `Expected payment source "${expected.source}", received "${String(operation.source)}".`,
    );
  }
  return operation;
}

export function assertInvokeContract(
  decoded: DecodedEnvelope,
  expectedContractId: string,
  operationIndex = 0,
): Extract<StellarOperation, { type: "invokeHostFunction" }> {
  const operation = decoded.operations[operationIndex];
  if (!operation) throw new Error(`No operation exists at index ${String(operationIndex)}.`);
  if (operation.type !== "invokeHostFunction") {
    throw new Error(
      `Expected invokeHostFunction at index ${String(operationIndex)}, received "${operation.type}".`,
    );
  }
  if (operation.func.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
    throw new Error(
      `Host function at index ${String(operationIndex)} is not a contract invocation.`,
    );
  }
  const address = operation.func.invokeContract().contractAddress();
  if (address.switch() !== xdr.ScAddressType.scAddressTypeContract()) {
    throw new Error(
      `Invocation at index ${String(operationIndex)} does not target a contract address.`,
    );
  }
  const contractId = StrKey.encodeContract(address.contractId() as unknown as Buffer);
  if (contractId !== expectedContractId) {
    throw new Error(`Expected contract "${expectedContractId}", received "${contractId}".`);
  }
  return operation;
}
