import { spawnSync } from "node:child_process";

// These advisories currently have no non-breaking patched release in the
// Expo 53 / React Native 0.79 dependency graph. Keep the exception narrow:
// any new advisory still fails CI, and this list must be reviewed when the
// Expo SDK is upgraded.
const allowedUnpatchedAdvisories = new Map([
  [1240992, "braces: build-tool glob denial of service"],
  [1240912, "node-forge: Expo code-signing verification"],
  [1241202, "sprintf-js: Metro build-tool denial of service"],
]);

const npmCommand = process.env.npm_execpath;
if (!npmCommand) {
  console.error("npm_execpath is unavailable; run this check through npm.");
  process.exit(1);
}
const audit = spawnSync(
  process.execPath,
  [npmCommand, "audit", "--omit=dev", "--audit-level=high", "--json"],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  process.stderr.write(audit.stderr || audit.stdout || "npm audit failed\n");
  process.exit(1);
}

const foundAdvisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const cause of vulnerability.via ?? []) {
    if (typeof cause === "object" && Number.isInteger(cause.source)) {
      foundAdvisories.set(cause.source, cause);
    }
  }
}

const unexpected = [...foundAdvisories.values()].filter(
  (advisory) => !allowedUnpatchedAdvisories.has(advisory.source),
);

if (unexpected.length > 0) {
  for (const advisory of unexpected) {
    console.error(
      `[security] ${advisory.severity}: ${advisory.title} (${advisory.url})`,
    );
  }
  process.exit(1);
}

for (const [source, reason] of allowedUnpatchedAdvisories) {
  if (foundAdvisories.has(source)) {
    console.warn(`[security] upstream exception ${source}: ${reason}`);
  }
}

console.log("Production dependency audit contains no unexpected advisories.");
