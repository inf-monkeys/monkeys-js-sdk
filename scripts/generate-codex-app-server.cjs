#!/usr/bin/env node
/* Regenerates src/codex-app-server/protocol from the locally installed Codex CLI. */
const { execFileSync } = require("node:child_process");
const { rmSync } = require("node:fs");
const path = require("node:path");

const expected = require("../package.json").codexAppServerCliVersion;
const version = execFileSync("codex", ["--version"], { encoding: "utf8" }).trim();
if (version !== `codex-cli ${expected}`) {
  console.error(`Expected codex-cli ${expected}, found ${version}`);
  process.exit(1);
}
const out = path.join(__dirname, "..", "src", "codex-app-server", "protocol");
rmSync(out, { recursive: true, force: true });
execFileSync("codex", ["app-server", "generate-ts", "--out", out], { stdio: "inherit" });
