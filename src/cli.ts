#!/usr/bin/env node
import { Networks } from "@stellar/stellar-sdk";
import { SCENARIO_NAMES } from "./scenarios.js";
import { decodeEnvelope } from "./xdr.js";

const [command, ...arguments_] = process.argv.slice(2);

function usage(): never {
  console.error(`Usage:
  stellar-wallet-testkit scenarios
  stellar-wallet-testkit decode <xdr> [--network testnet|public|<passphrase>]`);
  process.exit(1);
}

function resolveNetwork(value = "testnet"): string {
  if (value.toLowerCase() === "testnet") return Networks.TESTNET;
  if (value.toLowerCase() === "public") return Networks.PUBLIC;
  return value;
}

if (command === "scenarios") {
  for (const name of SCENARIO_NAMES) console.log(name);
} else if (command === "decode") {
  const xdrValue = arguments_[0];
  if (!xdrValue) usage();
  const networkIndex = arguments_.indexOf("--network");
  const passphrase = resolveNetwork(networkIndex >= 0 ? arguments_[networkIndex + 1] : undefined);
  try {
    const decoded = decodeEnvelope(xdrValue, passphrase);
    console.log(
      JSON.stringify(
        {
          source: decoded.source,
          feeBump: decoded.feeBump,
          operationCount: decoded.operations.length,
          operationTypes: decoded.operations.map(({ type }) => type),
          networkPassphrase: decoded.networkPassphrase,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
} else {
  usage();
}
