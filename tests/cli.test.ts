import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

const version = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

describe("CLI", () => {
  it("prints usage for --help, -h, help, and no arguments", () => {
    for (const argv of [[], ["--help"], ["-h"], ["help"]] as const) {
      const result = runCli(argv);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("stellar-wallet-testkit scenarios");
      expect(result.stdout).toContain("--version");
      expect(result.stderr).toBe("");
    }
  });

  it("prints the package version", () => {
    for (const command of ["--version", "-v", "version"] as const) {
      expect(runCli([command])).toEqual({
        exitCode: 0,
        stdout: `${version}\n`,
        stderr: "",
      });
    }
  });

  it("lists scenario presets", () => {
    const result = runCli(["scenarios"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("user-rejection");
    expect(result.stdout).toContain("signing-failure");
  });

  it("prints usage on unknown commands and missing decode input", () => {
    expect(runCli(["unknown"]).exitCode).toBe(1);
    expect(runCli(["decode"]).exitCode).toBe(1);
    expect(runCli(["decode"]).stderr).toContain("Usage:");
  });

  it("returns a dedicated exit code for malformed XDR", () => {
    const result = runCli(["decode", "not-xdr"]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
