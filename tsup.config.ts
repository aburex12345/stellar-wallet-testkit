import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/playwright.ts", "src/mock.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "node20",
});
