#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const arguments_ = process.argv.slice(2);
const dryRun = arguments_.includes("--dry-run");
const repoIndex = arguments_.indexOf("--repo");
const repository = repoIndex >= 0 ? arguments_[repoIndex + 1] : undefined;
if (repoIndex >= 0 && !repository) throw new Error("--repo requires OWNER/REPO.");
for (const argument of arguments_) {
  if (argument !== "--dry-run" && argument !== "--repo" && argument !== repository) {
    throw new Error(`Unknown argument: ${argument}`);
  }
}

const issues = JSON.parse(
  await readFile(new URL("../docs/wave-issues.json", import.meta.url), "utf8"),
);
if (!Array.isArray(issues)) throw new Error("Issue source must be an array.");
const seen = new Set();
for (const issue of issues) {
  if (!issue.title || seen.has(issue.title)) {
    throw new Error(`Missing or duplicate issue title: ${issue.title ?? "<missing>"}`);
  }
  seen.add(issue.title);
}

const repoArguments = repository ? ["--repo", repository] : [];
function gh(args, { capture = false, withRepo = true } = {}) {
  const commandRepoArguments = withRepo ? repoArguments : [];
  if (dryRun) {
    console.log(["gh", ...args, ...commandRepoArguments].map(JSON.stringify).join(" "));
    return "";
  }
  const result = spawnSync("gh", [...args, ...commandRepoArguments], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) throw new Error(`gh ${args[0]} failed with status ${result.status}.`);
  return result.stdout ?? "";
}

if (!dryRun) gh(["auth", "status"], { withRepo: false });

const labels = new Map([
  ["wave", ["5319E7", "Curated contributor-ready work"]],
  ["type: enhancement", ["1D76DB", "New or extended capability"]],
  ["type: testing", ["0E8A16", "Test coverage and infrastructure"]],
  ["type: compatibility", ["FBCA04", "Upstream compatibility"]],
  ["type: quality", ["C2E0C6", "Code and developer experience quality"]],
  ["type: bug", ["D73A4A", "Something is not working"]],
  ["type: refactor", ["BFD4F2", "Internal restructuring"]],
  ["type: documentation", ["0075CA", "Documentation improvement"]],
  ["type: security", ["B60205", "Security-focused improvement"]],
  ["type: release", ["7057FF", "Release engineering"]],
  ["type: example", ["D4C5F9", "Runnable usage example"]],
  ["type: community", ["C5DEF5", "Community process"]],
  ["type: performance", ["F9D0C4", "Performance and size"]],
  ["difficulty: beginner", ["C2E0C6", "Good first scoped contribution"]],
  ["difficulty: intermediate", ["FEF2C0", "Requires project familiarity"]],
  ["difficulty: advanced", ["F9D0C4", "Requires deep domain knowledge"]],
]);

for (const [name, [color, description]] of labels) {
  gh(["label", "create", name, "--color", color, "--description", description, "--force"]);
}

const existing = dryRun
  ? new Set()
  : new Set(
      JSON.parse(
        gh(["issue", "list", "--state", "all", "--limit", "1000", "--json", "title"], {
          capture: true,
        }),
      ).map(({ title }) => title),
    );

let created = 0;
let skipped = 0;
for (const issue of issues) {
  if (existing.has(issue.title)) {
    console.log(`skip existing: ${issue.title}`);
    skipped += 1;
    continue;
  }
  const body = `## Context
${issue.context}

## Scope / tasks
${issue.tasks.map((task) => `- [ ] ${task}`).join("\n")}

## Acceptance criteria
${issue.acceptance.map((item) => `- [ ] ${item}`).join("\n")}

## Likely files
${issue.files.map((file) => `- \`${file}\``).join("\n")}

## Tests
${issue.tests.map((test) => `- ${test}`).join("\n")}

_Generated from \`docs/wave-issues.json\`._`;
  gh([
    "issue",
    "create",
    "--title",
    issue.title,
    "--body",
    body,
    "--label",
    `wave,type: ${issue.type},difficulty: ${issue.difficulty}`,
  ]);
  created += 1;
}

console.log(`${dryRun ? "Would create" : "Created"} ${created}; skipped ${skipped}.`);
