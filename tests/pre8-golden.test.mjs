import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [target, forkRepo = "/home/ubuntu/meridianzen"] = process.argv.slice(2);
if (!target) throw new Error("pakai: node tests/pre8-golden.test.mjs <path-target> [fork-repo]");

const pack = dirname(dirname(fileURLToPath(import.meta.url)));
const snippet = (name) => readFileSync(join(pack, "core-patches/snip27", name), "utf8");
const installedExecutor = readFileSync(join(target, "tools/executor.js"), "utf8");
const installedDefinitions = readFileSync(join(target, "tools/definitions.js"), "utf8");
const forkExecutor = execFileSync("git", ["-C", forkRepo, "show", "643e954:tools/executor.js"], { encoding: "utf8" });
const forkDefinitions = execFileSync("git", ["-C", forkRepo, "show", "643e954:tools/definitions.js"], { encoding: "utf8" });

const forkHandler = forkExecutor.split("\n").slice(299, 737).join("\n") + "\n";
const forkDefinition = forkDefinitions.split("\n").slice(394, 440).join("\n") + "\n";
const handlerNew = snippet("update-config-NEW.txt");
const definitionNew = snippet("definition-NEW.txt");

assert.ok(installedExecutor.includes(handlerNew), "installed update_config bukan snippet NEW byte-exact");
assert.ok(installedDefinitions.includes(definitionNew), "installed definition bukan snippet NEW byte-exact");

let normalizedHandler = handlerNew
  .replace("    // [zen-pack:27-full] Patch 27 whitelist superseded by the full PRA-8 handler.\n", "")
  .replace("      loneCandidateMinDegen: [\"screening\", \"loneCandidateMinDegen\"],\n", "")
  .replace("      autoSwapRetryAttempts: [\"management\", \"autoSwapRetryAttempts\"],\n", "")
  .replace("      autoSwapRetryDelayMs: [\"management\", \"autoSwapRetryDelayMs\"],\n", "")
  .replace("      pnlConfirmTicks: [\"pnl\", \"confirmTicks\"],\n", "")
  .replace("      // vanilla opportunity poller / Degen Score (locked baseline delta #1/#2)\n", "")
  .replace(/^      (?:opportunity|degenTarget).*\n/gm, "")
  .replace("      // PRA-8 conscious fix: fork schema accepts strings but its restart loader\n      // only accepts arrays; normalize all four GMGN array keys before persist.\n      \"gmgnFilters\", \"gmgnPlatforms\", \"gmgnPreferredKolNames\", \"gmgnDumpKolNames\",\n", "")
  .replace("    // DEVIASI-SADAR #5: existing GMGN JSON corruption is fail-closed.\n    let gmgnConfig = {};\n    if (fs.existsSync(GMGN_CONFIG_PATH)) {\n      try {\n        gmgnConfig = JSON.parse(fs.readFileSync(GMGN_CONFIG_PATH, \"utf8\"));\n      } catch (error) {\n        return { success: false, error: `Invalid gmgn-config.json: ${error.message}`, reason };\n      }\n    }\n\n", "")
  .replace("    // Persist GMGN tuning to gmgn-config.json, and everything else to user-config.json.\n", "    // Persist GMGN tuning to gmgn-config.json, and everything else to user-config.json.\n    let gmgnConfig = {};\n    if (fs.existsSync(GMGN_CONFIG_PATH)) {\n      try { gmgnConfig = JSON.parse(fs.readFileSync(GMGN_CONFIG_PATH, \"utf8\")); } catch { /**/ }\n    }\n");
assert.equal(normalizedHandler, forkHandler, "handler golden drift di luar exception terukur");

const normalizedDefinition = definitionNew
  .replace(", loneCandidateMinDegen", "")
  .replace(", autoSwapRetryAttempts, autoSwapRetryDelayMs", "")
  .replace(", pnlConfirmTicks", "")
  .replace(/^Opportunity poller \/ Degen Score:.*\n/m, "")
  .replace("gmgnRequireBullishSt", "gmgnRequireBullishSupertrend")
  .replace("gmgnRejectAtBottom", "gmgnRejectAlreadyAtBottom")
  .replace("gmgnRequireAboveSt", "gmgnRequireAboveSupertrend");
assert.equal(normalizedDefinition, forkDefinition, "definition golden drift di luar 13 key + 3 nama");

console.log("PRE8-GOLDEN: handler/definition byte-exact after declared exceptions");
console.log("GOLDEN-EXCEPTIONS: marker=1 baseline-keys=13 arrays=4 fail-closed=1 definition-names=3");
