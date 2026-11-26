import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(pnpm, ["audit", "--prod", "--json"], {
  encoding: "utf8",
  env: process.env,
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const advisories = Object.values(report.advisories ?? {});
const ignored = [];
const blocking = [];

for (const advisory of advisories) {
  const paths = (advisory.findings ?? []).flatMap((finding) => finding.paths ?? []);
  const normalized = paths.map((path) => path.replaceAll("\\", "/"));
  const onlySandboxExample =
    advisory.github_advisory_id === "GHSA-mrhx-c7xc-m3w5" &&
    normalized.length > 0 &&
    normalized.every((path) => path.includes("packages/coding-agent/examples/extensions/sandbox"));

  if (onlySandboxExample) ignored.push(advisory);
  else blocking.push(advisory);
}

for (const advisory of ignored) {
  console.log(
    `IGNORED ${advisory.github_advisory_id}: ${advisory.module_name} ${advisory.patched_versions} ` +
      "(only the sandbox example depends on the last zod 3-compatible release; no production path is affected)",
  );
}

if (blocking.length > 0) {
  for (const advisory of blocking) {
    console.error(`${advisory.severity}: ${advisory.module_name} — ${advisory.title}`);
    for (const finding of advisory.findings ?? []) {
      for (const path of finding.paths ?? []) console.error(`  ${path}`);
    }
  }
  process.exit(1);
}

console.log("No production vulnerabilities found.");
