import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Address, Asset, StrKey, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  WalletController,
  assertInvokeContract,
  assertOperationCount,
  assertPayment,
  assertSource,
  createFreighterMock,
  decodeEnvelope,
  type SignAuthEntryOptions,
  type SignMessageOptions,
  type SignTransactionOptions,
  type WalletOperation,
  type WalletState,
} from "../src/index.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const corpusDir = resolve(currentDir, "..", "test-vectors");

interface CorpusIdentity {
  id: string;
  label: string;
  kind: "ed25519PublicKey" | "contract";
  fillByteHex: string;
  publicBytesHex: string;
  strKey: string;
  derivation: string;
}

interface CorpusSuiteIndexEntry {
  suite: "wallet-lifecycle" | "transactions" | "soroban";
  path: string;
  vectorCount: number;
  summary: string;
}

interface CorpusManifest {
  corpusVersion: string;
  schemaVersion: string;
  schemaPath: string;
  stellarProtocolVersion: number;
  stellarSdkVersion: string;
  xdrEncoding: string;
  freighterObjectResultSpec: string;
  secretPolicy: {
    mode: string;
    containsPrivateKeys: boolean;
    containsSeedPhrases: boolean;
    containsLiveCapturedTransactions: boolean;
    verificationRule: string;
  };
  identities: CorpusIdentity[];
  suites: CorpusSuiteIndexEntry[];
}

interface CorpusSchema {
  $schema: string;
}

interface SuiteMetadata {
  schemaVersion: string;
  corpusVersion: string;
  stellarProtocolVersion: number;
  stellarSdkVersion: string;
  xdrEncoding: string;
  freighterObjectResultSpec: string;
  secretPolicy: string;
}

interface VectorProvenance {
  generator: string;
  containsSecretMaterial: boolean;
  identitiesUsed: string[];
  deterministicConstruction: string;
  protocolNotes?: string;
}

interface VectorRequest {
  operation: WalletOperation;
  args: unknown[];
}

interface DecodedOperationExpectation {
  index: number;
  type: string;
  destination?: string;
  asset?: string;
  assetCode?: string;
  assetIssuer?: string;
  amount?: string;
}

interface DecodedContractInvocationExpectation {
  operationIndex: number;
  contractId: string;
  functionName: string;
  argCount: number;
  authEntryCount: number;
}

interface DecodedRootInvocationExpectation {
  contractId: string;
  functionName: string;
  argCount: number;
  subInvocationCount: number;
}

interface DecodedExpectations {
  envelopeType?: string;
  feeBump?: boolean;
  source?: string;
  operationCount?: number;
  operations?: DecodedOperationExpectation[];
  contractInvocation?: DecodedContractInvocationExpectation;
  xdrType?: string;
  credentialsType?: string;
  signerAddress?: string;
  nonce?: string;
  signatureExpirationLedger?: number;
  rootInvocation?: DecodedRootInvocationExpectation;
  networkIdHex?: string;
  rootContractId?: string;
  rootFunctionName?: string;
}

interface TestVector {
  id: string;
  title: string;
  category: string;
  provenance: VectorProvenance;
  initialState: WalletState;
  request: VectorRequest;
  expectedResult: Record<string, unknown>;
  decodedExpectations?: DecodedExpectations;
}

interface CorpusSuiteFile {
  metadata: SuiteMetadata;
  suite: "wallet-lifecycle" | "transactions" | "soroban";
  description: string;
  vectors: TestVector[];
}

function readJsonObject(relativePath: string): unknown {
  const raw = readFileSync(resolve(corpusDir, relativePath), "utf8");
  return JSON.parse(raw) as unknown;
}

function asStringArg(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function executeVectorRequest(
  initialState: WalletState,
  request: VectorRequest,
): Promise<unknown> {
  const mock = createFreighterMock(new WalletController(initialState));
  switch (request.operation) {
    case "isConnected":
      return mock.isConnected();
    case "isAllowed":
      return mock.isAllowed();
    case "getAddress":
      return mock.getAddress();
    case "requestAccess":
      return mock.requestAccess();
    case "getNetwork":
      return mock.getNetwork();
    case "signMessage": {
      const message = asStringArg(request.args[0]);
      const options = request.args[1] as SignMessageOptions | undefined;
      return mock.signMessage(message, options);
    }
    case "signTransaction": {
      const txXdr = asStringArg(request.args[0]);
      const options = request.args[1] as SignTransactionOptions | undefined;
      return mock.signTransaction(txXdr, options);
    }
    case "signAuthEntry": {
      const authXdr = asStringArg(request.args[0]);
      const options = request.args[1] as SignAuthEntryOptions | undefined;
      return mock.signAuthEntry(authXdr, options);
    }
  }
}

const STELLAR_TOKEN_PATTERN = /\b([GCSM][A-Z2-7]{55})\b/g;

function collectStrings(value: unknown, bucket: string[] = []): string[] {
  if (typeof value === "string") {
    bucket.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, bucket);
  } else if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) collectStrings(nested, bucket);
  }
  return bucket;
}

describe("wallet interoperability test-vector corpus", () => {
  const manifest = readJsonObject("manifest.json") as CorpusManifest;
  const schema = readJsonObject("schema.json") as CorpusSchema;
  const suites = manifest.suites.map(
    (entry) => readJsonObject(entry.path.replace(/^\.\//, "")) as CorpusSuiteFile,
  );

  it("defines versioned manifest, JSON schema, and aligned suite metadata", () => {
    expect(manifest.corpusVersion).toBe("1.0.0");
    expect(manifest.schemaVersion).toBe("1.0.0");
    expect(manifest.stellarProtocolVersion).toBeGreaterThanOrEqual(22);
    expect(manifest.stellarSdkVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.xdrEncoding).toBe("stellar-xdr-base64");
    expect(manifest.freighterObjectResultSpec).toBe("freighter-api-v2-object-result");
    expect(manifest.secretPolicy.mode).toBe("public-bytes-only");
    expect(manifest.secretPolicy.containsPrivateKeys).toBe(false);
    expect(manifest.secretPolicy.containsSeedPhrases).toBe(false);
    expect(manifest.secretPolicy.containsLiveCapturedTransactions).toBe(false);
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");

    for (const [index, entry] of manifest.suites.entries()) {
      const suiteFile = suites[index];
      expect(suiteFile).toBeDefined();
      if (!suiteFile) continue;
      expect(suiteFile.suite).toBe(entry.suite);
      expect(suiteFile.vectors).toHaveLength(entry.vectorCount);
      expect(suiteFile.metadata).toEqual({
        schemaVersion: manifest.schemaVersion,
        corpusVersion: manifest.corpusVersion,
        stellarProtocolVersion: manifest.stellarProtocolVersion,
        stellarSdkVersion: manifest.stellarSdkVersion,
        xdrEncoding: manifest.xdrEncoding,
        freighterObjectResultSpec: manifest.freighterObjectResultSpec,
        secretPolicy: "public-bytes-only",
      });
    }
  });

  it("derives every identity strictly from constant public byte fills with zero secret keys", () => {
    const allowedAddresses = new Set<string>();

    for (const identity of manifest.identities) {
      const fillByte = Number.parseInt(identity.fillByteHex, 16);
      expect(Number.isInteger(fillByte)).toBe(true);
      const expectedBytes = Buffer.alloc(32, fillByte);
      expect(identity.publicBytesHex).toBe(expectedBytes.toString("hex"));

      if (identity.kind === "ed25519PublicKey") {
        expect(StrKey.isValidEd25519PublicKey(identity.strKey)).toBe(true);
        expect(Buffer.from(StrKey.decodeEd25519PublicKey(identity.strKey))).toEqual(expectedBytes);
      } else {
        expect(StrKey.isValidContract(identity.strKey)).toBe(true);
        expect(Buffer.from(StrKey.decodeContract(identity.strKey))).toEqual(expectedBytes);
      }

      allowedAddresses.add(identity.strKey);
    }

    const allCorpusStrings = [
      ...collectStrings(manifest),
      ...suites.flatMap((suiteFile) => collectStrings(suiteFile)),
    ];

    for (const text of allCorpusStrings) {
      for (const match of text.matchAll(STELLAR_TOKEN_PATTERN)) {
        const candidate = match[1];
        if (!candidate) continue;
        expect(StrKey.isValidEd25519SecretSeed(candidate)).toBe(false);
        if (StrKey.isValidEd25519PublicKey(candidate) || StrKey.isValidContract(candidate)) {
          expect(allowedAddresses.has(candidate)).toBe(true);
        }
      }
    }
  });

  it("verifies unique vector IDs, provenance references, and exact Freighter object results", async () => {
    const seenIds = new Set<string>();
    const knownIdentityIds = new Set(manifest.identities.map((identity) => identity.id));

    for (const suiteFile of suites) {
      for (const vector of suiteFile.vectors) {
        expect(seenIds.has(vector.id)).toBe(false);
        seenIds.add(vector.id);

        expect(vector.provenance.containsSecretMaterial).toBe(false);
        expect(vector.provenance.generator.length).toBeGreaterThan(0);
        expect(vector.provenance.deterministicConstruction.length).toBeGreaterThan(0);
        expect(vector.provenance.identitiesUsed.length).toBeGreaterThan(0);

        for (const identityId of vector.provenance.identitiesUsed) {
          expect(knownIdentityIds.has(identityId)).toBe(true);
        }

        const actual = await executeVectorRequest(vector.initialState, vector.request);
        expect(actual).toEqual(vector.expectedResult);
      }
    }
  });

  it("decodes classic and fee-bump transaction vectors against declared structural expectations", () => {
    const txSuite = suites.find((suite) => suite.suite === "transactions");
    expect(txSuite).toBeDefined();
    if (!txSuite) return;

    for (const vector of txSuite.vectors) {
      const expected = vector.decodedExpectations;
      if (!expected) continue;
      const txXdr = asStringArg(vector.request.args[0]);
      const decoded = decodeEnvelope(txXdr, vector.initialState.networkPassphrase);

      expect(decoded.feeBump).toBe(expected.feeBump);
      assertSource(decoded, expected.source ?? "");
      assertOperationCount(decoded, expected.operationCount ?? 0);

      const firstOp = expected.operations?.[0];
      if (firstOp?.type === "payment") {
        const assetSpec =
          firstOp.asset === "native"
            ? Asset.native()
            : new Asset(firstOp.assetCode ?? "", firstOp.assetIssuer ?? "");
        assertPayment(decoded, {
          destination: firstOp.destination ?? "",
          amount: firstOp.amount ?? "",
          asset: assetSpec,
        });
      }
    }
  });

  it("decodes Soroban transaction, authorization entries, and preimage vectors cleanly", () => {
    const sorobanSuite = suites.find((suite) => suite.suite === "soroban");
    expect(sorobanSuite).toBeDefined();
    if (!sorobanSuite) return;

    for (const vector of sorobanSuite.vectors) {
      const expected = vector.decodedExpectations;
      if (!expected) continue;
      const payloadXdr = asStringArg(vector.request.args[0]);

      if (expected.envelopeType === "ENVELOPE_TYPE_TX" && expected.contractInvocation) {
        const decoded = decodeEnvelope(payloadXdr, vector.initialState.networkPassphrase);
        const contractInvocation = expected.contractInvocation;
        const op = assertInvokeContract(decoded, contractInvocation.contractId, 0);
        expect(op.func.invokeContract().functionName().toString()).toBe(
          contractInvocation.functionName,
        );
        expect(op.auth).toHaveLength(contractInvocation.authEntryCount);
      } else if (expected.xdrType === "SorobanAuthorizationEntry" && expected.rootInvocation) {
        const entry = xdr.SorobanAuthorizationEntry.fromXDR(payloadXdr, "base64");
        expect(entry.credentials().switch().name).toBe(expected.credentialsType);

        const rootInvocation = expected.rootInvocation;
        const contractFn = entry.rootInvocation().function().contractFn();
        expect(Address.fromScAddress(contractFn.contractAddress()).toString()).toBe(
          rootInvocation.contractId,
        );
        expect(contractFn.functionName().toString()).toBe(rootInvocation.functionName);
        expect(entry.rootInvocation().subInvocations()).toHaveLength(
          rootInvocation.subInvocationCount,
        );

        if (expected.credentialsType === "sorobanCredentialsAddress") {
          const addrCreds = entry.credentials().address();
          expect(Address.fromScAddress(addrCreds.address()).toString()).toBe(
            expected.signerAddress,
          );
          expect(addrCreds.nonce().toString()).toBe(expected.nonce);
          expect(addrCreds.signatureExpirationLedger()).toBe(expected.signatureExpirationLedger);
        }
      } else if (expected.xdrType === "HashIdPreimage") {
        const preimage = xdr.HashIdPreimage.fromXDR(payloadXdr, "base64");
        expect(preimage.switch().name).toBe(expected.envelopeType);
        const sorobanAuth = preimage.sorobanAuthorization();
        expect(Buffer.from(sorobanAuth.networkId()).toString("hex")).toBe(expected.networkIdHex);
        expect(sorobanAuth.nonce().toString()).toBe(expected.nonce);
        expect(sorobanAuth.signatureExpirationLedger()).toBe(expected.signatureExpirationLedger);
        const contractFn = sorobanAuth.invocation().function().contractFn();
        expect(Address.fromScAddress(contractFn.contractAddress()).toString()).toBe(
          expected.rootContractId,
        );
        expect(contractFn.functionName().toString()).toBe(expected.rootFunctionName);
      }
    }
  });
});
