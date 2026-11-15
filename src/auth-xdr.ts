import { Address, xdr } from "@stellar/stellar-sdk";

export interface SourceAccountCredentials {
  kind: "sourceAccount";
}

export interface AddressCredentials {
  kind: "address";
  address: string;
  nonce: string;
  signatureExpirationLedger: number;
  signature: xdr.ScVal;
}

export type DecodedAuthCredentials = SourceAccountCredentials | AddressCredentials;

export interface ContractFunctionInvocation {
  kind: "contract";
  contractId: string;
  functionName: string;
  args: readonly xdr.ScVal[];
}

export interface CreateContractFunctionInvocation {
  kind: "createContract";
  preimageType: "address" | "asset";
  executableType: "wasm" | "stellarAsset";
  wasmHashHex?: string;
}

export interface CreateContractV2FunctionInvocation {
  kind: "createContractV2";
  preimageType: "address" | "asset";
  executableType: "wasm" | "stellarAsset";
  wasmHashHex?: string;
  constructorArgs: readonly xdr.ScVal[];
}

export type DecodedAuthorizedFunction =
  | ContractFunctionInvocation
  | CreateContractFunctionInvocation
  | CreateContractV2FunctionInvocation;

export interface DecodedAuthorizedInvocation {
  function: DecodedAuthorizedFunction;
  subInvocations: readonly DecodedAuthorizedInvocation[];
  raw: xdr.SorobanAuthorizedInvocation;
}

export interface DecodedAuthEntry {
  format: "authorizationEntry";
  entry: xdr.SorobanAuthorizationEntry;
  credentials: DecodedAuthCredentials;
  rootInvocation: DecodedAuthorizedInvocation;
}

export interface DecodedAuthEntryPreimage {
  format: "authorizationPreimage" | "hashIdPreimage";
  networkIdHex: string;
  nonce: string;
  signatureExpirationLedger: number;
  rootInvocation: DecodedAuthorizedInvocation;
  raw: xdr.HashIdPreimageSorobanAuthorization;
}

export type DecodedSorobanAuthPayload = DecodedAuthEntry | DecodedAuthEntryPreimage;

export interface AuthInvocationExpectation {
  contractId?: string;
  functionName?: string;
  argCount?: number;
}

export class InvalidAuthEntryXdrError extends Error {
  constructor(
    message = "Malformed or unsupported Soroban authorization entry XDR.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InvalidAuthEntryXdrError";
  }
}

const STRICT_BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;

function decodeBase64Strict(normalized: string): Buffer {
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !STRICT_BASE64_RE.test(normalized)
  ) {
    throw new InvalidAuthEntryXdrError("Invalid Soroban auth entry XDR: malformed base64 input.");
  }
  return Buffer.from(normalized, "base64");
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function detectCap71UnsupportedDiscriminant(bytes: Buffer): boolean {
  if (bytes.byteLength < 4) return false;
  // SorobanCredentials discriminant 2 corresponds to SOROBAN_CREDENTIALS_ADDRESS_V2 (CAP-0071, Protocol 27).
  return bytes.readInt32BE(0) === 2;
}

function decodePreimageMeta(
  preimage: xdr.ContractIdPreimage,
  executable: xdr.ContractExecutable,
): {
  preimageType: "address" | "asset";
  executableType: "wasm" | "stellarAsset";
  wasmHashHex?: string;
} {
  const preimageType =
    preimage.switch() === xdr.ContractIdPreimageType.contractIdPreimageFromAddress()
      ? "address"
      : "asset";

  if (executable.switch() === xdr.ContractExecutableType.contractExecutableWasm()) {
    return {
      preimageType,
      executableType: "wasm",
      wasmHashHex: bytesToHex(executable.wasmHash()),
    };
  }

  return {
    preimageType,
    executableType: "stellarAsset",
  };
}

function decodeAuthorizedFunction(fn: xdr.SorobanAuthorizedFunction): DecodedAuthorizedFunction {
  const kind = fn.switch();

  if (kind === xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeContractFn()) {
    const invoke = fn.contractFn();
    const contractId = Address.fromScAddress(invoke.contractAddress()).toString();
    const functionName = invoke.functionName().toString();
    return {
      kind: "contract",
      contractId,
      functionName,
      args: invoke.args(),
    };
  }

  if (
    kind === xdr.SorobanAuthorizedFunctionType.sorobanAuthorizedFunctionTypeCreateContractHostFn()
  ) {
    const createArgs = fn.createContractHostFn();
    return {
      kind: "createContract",
      ...decodePreimageMeta(createArgs.contractIdPreimage(), createArgs.executable()),
    };
  }

  const createV2Args = fn.createContractV2HostFn();
  return {
    kind: "createContractV2",
    ...decodePreimageMeta(createV2Args.contractIdPreimage(), createV2Args.executable()),
    constructorArgs: createV2Args.constructorArgs(),
  };
}

function decodeInvocation(
  invocation: xdr.SorobanAuthorizedInvocation,
): DecodedAuthorizedInvocation {
  return {
    function: decodeAuthorizedFunction(invocation.function()),
    subInvocations: invocation.subInvocations().map((child) => decodeInvocation(child)),
    raw: invocation,
  };
}

function decodeCredentials(credentials: xdr.SorobanCredentials): DecodedAuthCredentials {
  if (credentials.switch() === xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount()) {
    return { kind: "sourceAccount" };
  }

  const addrCreds = credentials.address();
  return {
    kind: "address",
    address: Address.fromScAddress(addrCreds.address()).toString(),
    nonce: addrCreds.nonce().toString(),
    signatureExpirationLedger: addrCreds.signatureExpirationLedger(),
    signature: addrCreds.signature(),
  };
}

/**
 * Decodes a base64-encoded `xdr.SorobanAuthorizationEntry` into typed
 * credentials and invocation trees without performing any signing.
 *
 * Supported credential variants on `@stellar/stellar-sdk` v14 (Protocol 22):
 * - `sorobanCredentialsSourceAccount` (`kind: "sourceAccount"`)
 * - `sorobanCredentialsAddress` (`kind: "address"`)
 *
 * CAP-0071 note: Protocol 27 introduces `SOROBAN_CREDENTIALS_ADDRESS_V2` for
 * delegated custom-account authentication. Because `@stellar/stellar-sdk` ^14.1.1
 * predates Protocol 27 XDR definitions, CAP-0071 `ADDRESS_V2` entries are
 * rejected with a deterministic {@link InvalidAuthEntryXdrError} explaining the
 * SDK version boundary.
 */
export function decodeAuthEntry(xdrValue: string): DecodedAuthEntry {
  const normalized = xdrValue.trim();
  if (!normalized) {
    throw new InvalidAuthEntryXdrError("Auth entry XDR must not be empty.");
  }

  const bytes = decodeBase64Strict(normalized);

  try {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(bytes);
    if (entry.toXDR().byteLength !== bytes.byteLength) {
      throw new Error("Trailing bytes in SorobanAuthorizationEntry XDR.");
    }
    return {
      format: "authorizationEntry",
      entry,
      credentials: decodeCredentials(entry.credentials()),
      rootInvocation: decodeInvocation(entry.rootInvocation()),
    };
  } catch (cause) {
    if (detectCap71UnsupportedDiscriminant(bytes)) {
      throw new InvalidAuthEntryXdrError(
        "Unsupported CAP-0071 SorobanCredentials discriminant (SOROBAN_CREDENTIALS_ADDRESS_V2 requires @stellar/stellar-sdk >= 17 / Protocol 27 XDR).",
        { cause },
      );
    }
    throw new InvalidAuthEntryXdrError(
      cause instanceof Error ? `Invalid Soroban auth entry XDR: ${cause.message}` : undefined,
      { cause },
    );
  }
}

/**
 * Decodes a Freighter `signAuthEntry` authorization preimage XDR payload —
 * either a raw `xdr.HashIdPreimageSorobanAuthorization` or an envelope-tagged
 * `xdr.HashIdPreimage` (`envelopeTypeSorobanAuthorization`) — without signing.
 */
export function decodeAuthEntryPreimage(xdrValue: string): DecodedAuthEntryPreimage {
  const normalized = xdrValue.trim();
  if (!normalized) {
    throw new InvalidAuthEntryXdrError("Auth entry preimage XDR must not be empty.");
  }

  const bytes = decodeBase64Strict(normalized);

  try {
    const hashIdPreimage = xdr.HashIdPreimage.fromXDR(bytes);
    if (
      hashIdPreimage.switch() === xdr.EnvelopeType.envelopeTypeSorobanAuthorization() &&
      hashIdPreimage.toXDR().byteLength === bytes.byteLength
    ) {
      const inner = hashIdPreimage.sorobanAuthorization();
      return {
        format: "hashIdPreimage",
        networkIdHex: bytesToHex(inner.networkId()),
        nonce: inner.nonce().toString(),
        signatureExpirationLedger: inner.signatureExpirationLedger(),
        rootInvocation: decodeInvocation(inner.invocation()),
        raw: inner,
      };
    }
  } catch {
    // Fall through to raw HashIdPreimageSorobanAuthorization decoding.
  }

  try {
    const preimage = xdr.HashIdPreimageSorobanAuthorization.fromXDR(bytes);
    if (preimage.toXDR().byteLength !== bytes.byteLength) {
      throw new Error("Trailing bytes in HashIdPreimageSorobanAuthorization XDR.");
    }
    return {
      format: "authorizationPreimage",
      networkIdHex: bytesToHex(preimage.networkId()),
      nonce: preimage.nonce().toString(),
      signatureExpirationLedger: preimage.signatureExpirationLedger(),
      rootInvocation: decodeInvocation(preimage.invocation()),
      raw: preimage,
    };
  } catch (cause) {
    throw new InvalidAuthEntryXdrError(
      cause instanceof Error
        ? `Invalid Soroban auth entry preimage XDR: ${cause.message}`
        : undefined,
      { cause },
    );
  }
}

/**
 * Decodes any supported Soroban authorization XDR variant (`SorobanAuthorizationEntry`,
 * `HashIdPreimage` with `envelopeTypeSorobanAuthorization`, or
 * `HashIdPreimageSorobanAuthorization`) without performing any signing.
 */
export function decodeSorobanAuth(xdrValue: string): DecodedSorobanAuthPayload {
  const normalized = xdrValue.trim();
  if (!normalized) {
    throw new InvalidAuthEntryXdrError("Auth entry XDR must not be empty.");
  }

  try {
    return decodeAuthEntry(normalized);
  } catch (entryError) {
    if (entryError instanceof InvalidAuthEntryXdrError && entryError.message.includes("CAP-0071")) {
      throw entryError;
    }
    try {
      return decodeAuthEntryPreimage(normalized);
    } catch {
      throw entryError;
    }
  }
}

/**
 * Asserts that a decoded Soroban authorization payload carries an invocation of
 * a contract function matching the supplied expectation.
 */
export function assertAuthContractInvocation(
  decoded: DecodedSorobanAuthPayload,
  expected: AuthInvocationExpectation,
): ContractFunctionInvocation {
  const fn = decoded.rootInvocation.function;
  if (fn.kind !== "contract") {
    throw new Error(`Expected contract authorization invocation, received "${fn.kind}".`);
  }
  if (expected.contractId && fn.contractId !== expected.contractId) {
    throw new Error(
      `Expected authorized contract "${expected.contractId}", received "${fn.contractId}".`,
    );
  }
  if (expected.functionName && fn.functionName !== expected.functionName) {
    throw new Error(
      `Expected authorized function "${expected.functionName}", received "${fn.functionName}".`,
    );
  }
  if (expected.argCount !== undefined && fn.args.length !== expected.argCount) {
    throw new Error(
      `Expected ${String(expected.argCount)} argument(s), received ${String(fn.args.length)}.`,
    );
  }
  return fn;
}
