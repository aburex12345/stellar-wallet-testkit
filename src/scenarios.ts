import { Networks } from "@stellar/stellar-sdk";
import { DEFAULT_ADDRESS, type WalletControllerOptions } from "./types.js";

export type ScenarioName =
  | "user-rejection"
  | "wallet-missing"
  | "wrong-network"
  | "timeout"
  | "account-changed"
  | "malformed-signature-response"
  | "signing-failure";

export const SECONDARY_ADDRESS = "GBXSEOMHCQ5VZDR2NIDJIQ7HISVUKFLF6H4YLKQIYMKSHBDXEDX2DP7J";

export function scenario(name: ScenarioName): WalletControllerOptions {
  switch (name) {
    case "user-rejection":
      return {
        allowed: false,
        scripts: [
          {
            operation: "requestAccess",
            error: { code: "USER_DECLINED", message: "The user rejected the request." },
          },
        ],
      };
    case "wallet-missing":
      return { installed: false, connected: false, allowed: false };
    case "wrong-network":
      return { network: "PUBLIC", networkPassphrase: Networks.PUBLIC };
    case "timeout":
      return { scripts: [{ operation: "requestAccess", timeout: true }] };
    case "account-changed":
      return {
        address: DEFAULT_ADDRESS,
        scripts: [{ operation: "getAddress", statePatch: { address: SECONDARY_ADDRESS } }],
      };
    case "malformed-signature-response":
      return {
        scripts: [
          {
            operation: "signTransaction",
            result: { signedTxXdr: "not-xdr", signerAddress: DEFAULT_ADDRESS },
          },
        ],
      };
    case "signing-failure":
      return {
        scripts: [
          {
            operation: "signTransaction",
            error: { code: "SIGNING_FAILED", message: "The test wallet failed to sign." },
          },
        ],
      };
    default: {
      const exhaustive: never = name;
      throw new RangeError(`Unknown scenario: ${String(exhaustive)}`);
    }
  }
}

export const SCENARIO_NAMES: readonly ScenarioName[] = [
  "user-rejection",
  "wallet-missing",
  "wrong-network",
  "timeout",
  "account-changed",
  "malformed-signature-response",
  "signing-failure",
];
