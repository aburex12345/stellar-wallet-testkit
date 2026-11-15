import { Address, Asset, nativeToScVal, StrKey, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  assertAuthContractInvocation,
  createFreighterMock,
  decodeAuthEntry,
  decodeAuthEntryPreimage,
  decodeSorobanAuth,
  DEFAULT_ADDRESS,
  InvalidAuthEntryXdrError,
} from "../src/index.js";

const contractId = StrKey.encodeContract(Buffer.alloc(32, 3));
const subContractId = StrKey.encodeContract(Buffer.alloc(32, 4));
const issuerAddress = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 5));

function buildContractInvocation(
  target = contractId,
  fnName = "transfer",
  subInvocations: xdr.SorobanAuthorizedInvocation[] = [],
): xdr.SorobanAuthorizedInvocation {
  const fn = xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
    new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(target).toScAddress(),
      functionName: fnName,
      args: [Address.fromString(DEFAULT_ADDRESS).toScVal(), nativeToScVal(250n, { type: "i128" })],
    }),
  );
  return new xdr.SorobanAuthorizedInvocation({
    function: fn,
    subInvocations,
  });
}

describe("Soroban auth-entry XDR utilities", () => {
  it("decodes source-account credentials and nested contract sub-invocations", () => {
    const child = buildContractInvocation(subContractId, "burn");
    const root = buildContractInvocation(contractId, "swap", [child]);
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: root,
    });

    const decoded = decodeAuthEntry(entry.toXDR("base64"));
    expect(decoded.format).toBe("authorizationEntry");
    expect(decoded.credentials).toEqual({ kind: "sourceAccount" });
    expect(decoded.rootInvocation.function.kind).toBe("contract");
    if (decoded.rootInvocation.function.kind === "contract") {
      expect(decoded.rootInvocation.function.contractId).toBe(contractId);
      expect(decoded.rootInvocation.function.functionName).toBe("swap");
      expect(decoded.rootInvocation.function.args).toHaveLength(2);
    }
    expect(decoded.rootInvocation.subInvocations).toHaveLength(1);
    const subFn = decoded.rootInvocation.subInvocations[0]?.function;
    expect(subFn?.kind).toBe("contract");
    if (subFn?.kind === "contract") {
      expect(subFn.contractId).toBe(subContractId);
      expect(subFn.functionName).toBe("burn");
    }
  });

  it("decodes address credentials without mutating or signing the entry", async () => {
    const root = buildContractInvocation();
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.fromString(DEFAULT_ADDRESS).toScAddress(),
          nonce: xdr.Int64.fromString("9876543210"),
          signatureExpirationLedger: 54321,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
      rootInvocation: root,
    });

    const rawXdr = entry.toXDR("base64");
    const mock = createFreighterMock();
    const signed = await mock.signAuthEntry(`  ${rawXdr}  `);
    expect(signed.error).toBeUndefined();

    const decoded = decodeAuthEntry(signed.signedAuthEntry);
    expect(decoded.credentials.kind).toBe("address");
    if (decoded.credentials.kind === "address") {
      expect(decoded.credentials.address).toBe(DEFAULT_ADDRESS);
      expect(decoded.credentials.nonce).toBe("9876543210");
      expect(decoded.credentials.signatureExpirationLedger).toBe(54321);
      expect(decoded.credentials.signature.switch()).toBe(xdr.ScValType.scvVoid());
    }
    expect(decoded.entry.toXDR("base64")).toBe(rawXdr);
  });

  it("decodes createContract and createContractV2 authorized host functions", () => {
    const wasmHash = Buffer.alloc(32, 9);
    const preimageFromAddress = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
      new xdr.ContractIdPreimageFromAddress({
        address: Address.fromString(DEFAULT_ADDRESS).toScAddress(),
        salt: Buffer.alloc(32, 1),
      }),
    );
    const preimageFromAsset = xdr.ContractIdPreimage.contractIdPreimageFromAsset(
      new Asset("USDC", issuerAddress).toXDRObject(),
    );

    const v1Entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractHostFn(
          new xdr.CreateContractArgs({
            contractIdPreimage: preimageFromAddress,
            executable: xdr.ContractExecutable.contractExecutableWasm(wasmHash),
          }),
        ),
        subInvocations: [],
      }),
    });

    const decodedV1 = decodeAuthEntry(v1Entry.toXDR("base64"));
    expect(decodedV1.rootInvocation.function).toEqual({
      kind: "createContract",
      preimageType: "address",
      executableType: "wasm",
      wasmHashHex: wasmHash.toString("hex"),
    });

    const v2Entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractV2HostFn(
          new xdr.CreateContractArgsV2({
            contractIdPreimage: preimageFromAsset,
            executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
            constructorArgs: [nativeToScVal("init")],
          }),
        ),
        subInvocations: [],
      }),
    });

    const decodedV2 = decodeAuthEntry(v2Entry.toXDR("base64"));
    expect(decodedV2.rootInvocation.function.kind).toBe("createContractV2");
    if (decodedV2.rootInvocation.function.kind === "createContractV2") {
      expect(decodedV2.rootInvocation.function.preimageType).toBe("asset");
      expect(decodedV2.rootInvocation.function.executableType).toBe("stellarAsset");
      expect(decodedV2.rootInvocation.function.constructorArgs).toHaveLength(1);
    }
  });

  it("decodes both raw and HashIdPreimage-wrapped Soroban authorization preimages", () => {
    const networkId = Buffer.alloc(32, 7);
    const preimage = new xdr.HashIdPreimageSorobanAuthorization({
      networkId,
      nonce: xdr.Int64.fromString("77"),
      signatureExpirationLedger: 1000,
      invocation: buildContractInvocation(contractId, "approve"),
    });

    const rawDecoded = decodeAuthEntryPreimage(preimage.toXDR("base64"));
    expect(rawDecoded.format).toBe("authorizationPreimage");
    expect(rawDecoded.networkIdHex).toBe(networkId.toString("hex"));
    expect(rawDecoded.nonce).toBe("77");
    expect(rawDecoded.signatureExpirationLedger).toBe(1000);

    const wrapped = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(preimage);
    const wrappedDecoded = decodeSorobanAuth(wrapped.toXDR("base64"));
    expect(wrappedDecoded.format).toBe("hashIdPreimage");
    assertAuthContractInvocation(wrappedDecoded, {
      contractId,
      functionName: "approve",
      argCount: 2,
    });
  });

  it("auto-detects SorobanAuthorizationEntry and preimage payloads in decodeSorobanAuth", () => {
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: buildContractInvocation(contractId, "mint"),
    });
    const decoded = decodeSorobanAuth(entry.toXDR("base64"));
    expect(decoded.format).toBe("authorizationEntry");
    const fn = assertAuthContractInvocation(decoded, {
      contractId,
      functionName: "mint",
      argCount: 2,
    });
    expect(fn.functionName).toBe("mint");
  });

  it("reports descriptive assertion mismatches", () => {
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: buildContractInvocation(contractId, "mint"),
    });
    const decoded = decodeAuthEntry(entry.toXDR("base64"));
    expect(() => assertAuthContractInvocation(decoded, { contractId: subContractId })).toThrow(
      "Expected authorized contract",
    );
    expect(() => assertAuthContractInvocation(decoded, { functionName: "burn" })).toThrow(
      "Expected authorized function",
    );
    expect(() => assertAuthContractInvocation(decoded, { argCount: 5 })).toThrow(
      "Expected 5 argument(s)",
    );

    const createEntry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeCreateContractHostFn(
          new xdr.CreateContractArgs({
            contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAsset(
              new Asset("USDC", issuerAddress).toXDRObject(),
            ),
            executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
          }),
        ),
        subInvocations: [],
      }),
    });
    expect(() =>
      assertAuthContractInvocation(decodeAuthEntry(createEntry.toXDR("base64")), {}),
    ).toThrow('received "createContract"');
  });

  it("normalizes empty, non-base64, trailing-byte, and CAP-0071 v2 credential errors", () => {
    expect(() => decodeAuthEntry("   ")).toThrow(InvalidAuthEntryXdrError);
    expect(() => decodeAuthEntryPreimage("")).toThrow(InvalidAuthEntryXdrError);
    expect(() => decodeSorobanAuth("")).toThrow(InvalidAuthEntryXdrError);
    expect(() => decodeAuthEntry("not-valid-base64!")).toThrow("malformed base64");
    expect(() => decodeAuthEntryPreimage("AAAA")).toThrow(InvalidAuthEntryXdrError);
    expect(() => decodeSorobanAuth("AAAA")).toThrow(InvalidAuthEntryXdrError);

    const valid = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: buildContractInvocation(),
    });
    const withTrailing = Buffer.concat([valid.toXDR(), Buffer.from([1, 2, 3, 4])]).toString(
      "base64",
    );
    expect(() => decodeAuthEntry(withTrailing)).toThrow(InvalidAuthEntryXdrError);

    // Discriminant 2 = SOROBAN_CREDENTIALS_ADDRESS_V2 (CAP-0071, Protocol 27)
    const cap71Bytes = Buffer.alloc(16);
    cap71Bytes.writeInt32BE(2, 0);
    try {
      decodeSorobanAuth(cap71Bytes.toString("base64"));
      throw new Error("expected CAP-0071 payload to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAuthEntryXdrError);
      expect((error as InvalidAuthEntryXdrError).message).toContain("CAP-0071");
      expect((error as InvalidAuthEntryXdrError).cause).toBeInstanceOf(Error);
    }
  });
});
