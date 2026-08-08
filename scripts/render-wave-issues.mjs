#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = JSON.parse(await readFile(`${root}docs/wave-issues.json`, "utf8"));

if (!Array.isArray(source) || source.length !== 36) {
  throw new Error(
    `Expected exactly 36 issues, found ${Array.isArray(source) ? source.length : 0}.`,
  );
}

const titles = source.map(({ title }) => title);
const duplicate = titles.find((title, index) => titles.indexOf(title) !== index);
if (duplicate) throw new Error(`Duplicate issue title: ${duplicate}`);

let markdown = `# Wave Contributor Issues

This catalog is generated from [wave-issues.json](wave-issues.json), the machine-readable source of
truth. Each issue extends the implemented baseline; none asks a contributor to build the core
project from scratch. Run \`npm run issues:render\` after source changes.

`;

let number = 0;
for (const group of [...new Set(source.map(({ group }) => group))]) {
  markdown += `## ${group}\n\n`;
  for (const issue of source.filter((candidate) => candidate.group === group)) {
    number += 1;
    markdown += `### ${number}. ${issue.title}\n\n`;
    markdown += `**Difficulty:** ${issue.difficulty} · **Type:** ${issue.type}\n\n`;
    markdown += `**Context:** ${issue.context}\n\n**Scope/tasks:**\n`;
    markdown += issue.tasks.map((task) => `- ${task}`).join("\n");
    markdown += `\n\n**Acceptance criteria:**\n`;
    markdown += issue.acceptance.map((criterion) => `- ${criterion}`).join("\n");
    markdown += `\n\n**Likely files:** ${issue.files.map((file) => `\`${file}\``).join(", ")}\n\n`;
    markdown += `**Tests:** ${issue.tests.join("; ")}\n\n`;
  }
}

await writeFile(`${root}docs/WAVE_ISSUES.md`, await format(markdown, { parser: "markdown" }));
console.log(`Rendered ${source.length} issues to docs/WAVE_ISSUES.md`);
