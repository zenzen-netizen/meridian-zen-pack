import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const entries = manifest.runtime_data.entries;
const paths = entries.map((entry) => entry.path);

assert.equal(new Set(paths).size, paths.length, "runtime_data paths must be unique");
assert.ok(paths.includes("candidate-memory.json"));
assert.ok(paths.includes("exports/"));
assert.ok(paths.includes("profiles/"));

for (const entry of entries) {
  assert.ok(entry.path && entry.evidence.length, `missing evidence: ${entry.path}`);
  for (const evidence of entry.evidence) {
    assert.match(evidence, /:\d+$/, `evidence needs file:line: ${evidence}`);
    if (evidence.startsWith("upstream@")) continue;
    const split = evidence.lastIndexOf(":");
    const file = join(root, evidence.slice(0, split));
    const line = Number(evidence.slice(split + 1));
    assert.ok(existsSync(file), `evidence file missing: ${evidence}`);
    assert.ok(readFileSync(file, "utf8").split("\n").length >= line, `evidence line missing: ${evidence}`);
  }
}

for (const name of readFileSync(join(root, "plugins/paths.js"), "utf8").matchAll(/path\.join\(dataDir, "([^"]+)"\)/g)) {
  assert.ok(paths.some((path) => path.replace(/\/$/, "") === name[1]), `paths.js entry absent: ${name[1]}`);
}

const fixture = mkdtempSync(join(tmpdir(), "zenpack-runtime-data-"));
execFileSync("git", ["init", "-q", fixture]);
execFileSync("git", ["-C", fixture, "config", "user.email", "fixture@example.invalid"]);
execFileSync("git", ["-C", fixture, "config", "user.name", "Fixture"]);
writeFileSync(join(fixture, "base.txt"), "base\n");
execFileSync("git", ["-C", fixture, "add", "base.txt"]);
execFileSync("git", ["-C", fixture, "commit", "-qm", "base"]);
writeFileSync(join(fixture, "candidate-memory.json"), "{}\n");
mkdirSync(join(fixture, "exports"));
writeFileSync(join(fixture, "exports", "result.txt"), "fixture\n");

const script = join(root, "scripts/runtime-data.mjs");
execFileSync(process.execPath, [script, "check", fixture]);
assert.match(execFileSync(process.execPath, [script, "existing", fixture], { encoding: "utf8" }), /candidate-memory\.json/);
writeFileSync(join(fixture, "unknown.json"), "{}\n");
const rejected = spawnSync(process.execPath, [script, "check", fixture], { encoding: "utf8" });
assert.notEqual(rejected.status, 0);
assert.match(rejected.stderr, /unknown\.json/);

console.log(`runtime-data: ${entries.length} whitelist entries + porcelain gate PASS`);
