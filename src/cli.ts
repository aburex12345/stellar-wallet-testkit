#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Networks } from "@stellar/stellar-sdk";
import { SCENARIO_NAMES } from "./scenarios.js";
import { decodeEnvelope } from "./xdr.js";

const USAGE = `Usage:
  stellar-wallet-testkit scenarios [--json]
  stellar-wallet-testkit decode <xdr> [--network testnet|public|futurenet|<passphrase>]
  stellar-wallet-testkit --help
  stellar-wallet-testkit --version`;

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function packageVersion(): string {
  const packagePath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  return (JSON.parse(readFileSync(packagePath, "utf8")) as { version: string }).version;
}

export function resolveNetwork(value?: string): string {
  const network = value ?? "testnet";
  const normalized = network.toLowerCase();
  if (normalized === "testnet") return Networks.TESTNET;
  if (normalized === "public") return Networks.PUBLIC;
  if (normalized === "futurenet") return Networks.FUTURENET;
  return network;
}

export function runCli(argv: readonly string[]): CliResult {
  const [command, ...arguments_] = argv;

  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    return { exitCode: 0, stdout: `${USAGE}\n`, stderr: "" };
  }

  if (command === "--version" || command === "-v" || command === "version") {
    return { exitCode: 0, stdout: `${packageVersion()}\n`, stderr: "" };
  }

  if (command === "scenarios") {
    if (arguments_.includes("--json")) {
      return { exitCode: 0, stdout: `${JSON.stringify([...SCENARIO_NAMES])}\n`, stderr: "" };
    }
    return { exitCode: 0, stdout: `${SCENARIO_NAMES.join("\n")}\n`, stderr: "" };
  }

  if (command === "decode") {
    const xdrValue = arguments_[0];
    if (!xdrValue) {
      return { exitCode: 1, stdout: "", stderr: `${USAGE}\n` };
    }
    const networkIndex = arguments_.indexOf("--network");
    const passphrase = resolveNetwork(networkIndex >= 0 ? arguments_[networkIndex + 1] : undefined);
    try {
      const decoded = decodeEnvelope(xdrValue, passphrase);
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(
          {
            source: decoded.source,
            feeBump: decoded.feeBump,
            operationCount: decoded.operations.length,
            operationTypes: decoded.operations.map(({ type }) => type),
            networkPassphrase: decoded.networkPassphrase,
          },
          null,
          2,
        )}\n`,
        stderr: "",
      };
    } catch (error) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`,
      };
    }
  }

  return { exitCode: 1, stdout: "", stderr: `${USAGE}\n` };
}

function isEntrypoint(): boolean {
  const executed = process.argv[1];
  if (!executed) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(executed);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  const result = runCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
