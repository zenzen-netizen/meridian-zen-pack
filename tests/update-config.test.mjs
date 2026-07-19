import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) {
  console.error("pakai: node tests/update-config.test.mjs <path-target>");
  process.exit(1);
}

process.chdir(target);
process.env.DRY_RUN = "true";
process.env.WALLET_PRIVATE_KEY ||= "11111111111111111111111111111111";
process.env.RPC_URL ||= "http://127.0.0.1:8899";
process.env.OPENROUTER_API_KEY ||= "dummy";

const temp = mkdtempSync(join(tmpdir(), "zenpack-update-config-"));
const files = ["user-config.json", "gmgn-config.json", "lessons.json"];
const states = files.map((file) => ({ file, had: existsSync(file), backup: join(temp, file) }));
for (const state of states) if (state.had) copyFileSync(state.file, state.backup);
function restore() {
  for (const state of states) {
    if (state.had) copyFileSync(state.backup, state.file);
    else if (existsSync(state.file)) unlinkSync(state.file);
  }
}
process.on("exit", restore);

writeFileSync("user-config.json", "{}\n");
writeFileSync("gmgn-config.json", "{}\n");
writeFileSync("lessons.json", '{"lessons":[],"performance":[]}\n');

let txCalls = 0;
globalThis.fetch = async (input) => {
  const url = String(input || "");
  if (/execution|swap|quote|rpc/i.test(url)) txCalls++;
  throw new Error("network forbidden in update_config money gate");
};

const url = (file) => pathToFileURL(join(target, file)).href;
const { config, reloadScreeningThresholds } = await import(url("config.js"));
const hooks = await import(url("zenpack-lib/hooks.js"));
const { loadPlugins } = await import(url("zenpack-lib/loader.js"));
const loaded = await loadPlugins(join(target, "zenpack-plugins"), hooks);
assert.equal(loaded.errors.length, 0);
const { executeTool } = await import(url("tools/executor.js"));
const { CONFIG_SCHEMA } = await import(url("config-schema.js"));

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
let pass = 0;
async function t(name, fn) {
  await fn();
  pass++;
  console.log("  ✅", name);
}

await t("merged map/schema retain all 181 keys", () => {
  const source = readFileSync("tools/executor.js", "utf8");
  const map = source.slice(source.indexOf("    const CONFIG_MAP = {"), source.indexOf("\n    };", source.indexOf("    const CONFIG_MAP = {")));
  const keys = [...map.matchAll(/^\s{6}([A-Za-z_][A-Za-z0-9_]*):/gm)].map((match) => match[1]);
  assert.equal(new Set(keys).size, 181);
  assert.equal(Object.keys(CONFIG_SCHEMA).length, 181);
  for (const key of ["opportunityPollEnabled", "degenTargetLiquidity", "autoSwapRetryAttempts", "pnlConfirmTicks"]) {
    assert.ok(keys.includes(key), `${key} absent from handler`);
    assert.ok(CONFIG_SCHEMA[key], `${key} absent from schema`);
  }
});

await t("flat key/value writes GMGN only", async () => {
  const result = await executeTool("update_config", { key: "gmgnInterval", value: "1h", reason: "test" });
  assert.equal(result.success, true);
  assert.equal(readJson("gmgn-config.json").interval, "1h");
  assert.equal(Object.hasOwn(readJson("user-config.json"), "gmgnInterval"), false);
});

await t("path, section-nested, bare, and array recovery match fork", async () => {
  await executeTool("update_config", { path: "gmgn.indicatorRules.gmgnMinRsi", value: "25" });
  await executeTool("update_config", { gmgn: { gmgnMinMcap: 222000 } });
  await executeTool("update_config", { gmgnRequireBullishSt: false });
  await executeTool("update_config", { key: "gmgnPlatforms", value: "Pump.fun,pool_meteora" });
  const gmgn = readJson("gmgn-config.json");
  assert.equal(gmgn.indicatorRules.minRsi, 25);
  assert.equal(gmgn.indicatorRules.requireBullishSupertrend, false);
  assert.equal(gmgn.minMcap, 222000);
  assert.deepEqual(gmgn.platforms, ["Pump.fun", "pool_meteora"]);

  reloadScreeningThresholds();
  assert.deepEqual(config.gmgn.platforms, ["Pump.fun", "pool_meteora"], "array survives reload");

  const restartScript = `
    import { join } from "node:path";
    import { pathToFileURL } from "node:url";
    const root = process.argv[1];
    const url = (file) => pathToFileURL(join(root, file)).href;
    const { config } = await import(url("config.js"));
    const hooks = await import(url("zenpack-lib/hooks.js"));
    const { loadPlugins } = await import(url("zenpack-lib/loader.js"));
    const loaded = await loadPlugins(join(root, "zenpack-plugins"), hooks);
    if (loaded.errors.length) throw new Error(JSON.stringify(loaded.errors));
    console.log("PRA8_RESTART=" + JSON.stringify(config.gmgn.platforms));
    process.exit(0);
  `;
  const restartOut = execFileSync(process.execPath, ["--input-type=module", "-e", restartScript, target], {
    cwd: target,
    encoding: "utf8",
    env: { ...process.env, DRY_RUN: "true" },
  });
  const marker = restartOut.split("\n").find((line) => line.startsWith("PRA8_RESTART="));
  assert.deepEqual(JSON.parse(marker.slice("PRA8_RESTART=".length)), ["Pump.fun", "pool_meteora"], "array survives restart");
});

await t("13-key baseline stays executable and persists to user config", async () => {
  const result = await executeTool("update_config", { changes: { opportunityPollLimit: 7, degenTargetLiquidity: 30000 } });
  assert.equal(result.success, true);
  assert.equal(config.opportunity.limit, 7);
  assert.equal(config.opportunity.targetLiquidity, 30000);
  assert.equal(readJson("user-config.json").opportunityPollLimit, 7);
});

await t("partial apply preserves valid values and exposes invalid[]", async () => {
  const beforeLock = config.strategy.strategyLock;
  const result = await executeTool("update_config", {
    changes: { gmgnMinVolume: 1234, strategyLock: "invalid-lock" },
  });
  assert.equal(result.success, true);
  assert.equal(result.applied.gmgnMinVolume, 1234);
  assert.equal(result.invalid[0].key, "strategyLock");
  assert.equal(config.strategy.strategyLock, beforeLock);
  assert.equal(readJson("gmgn-config.json").minVolume, 1234);
});

await t("mixed call writes each config to its canonical file", async () => {
  await executeTool("update_config", { changes: { minTvl: 40000, gmgnMinHolders: 600 } });
  assert.equal(readJson("user-config.json").minTvl, 40000);
  assert.equal(readJson("gmgn-config.json").minHolders, 600);
  assert.equal(Object.hasOwn(readJson("user-config.json"), "gmgnMinHolders"), false);
});

await t("sensitive values are redacted from result, logs, and lessons", async () => {
  const secret = "gmgn-secret-fixture";
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  let result;
  try {
    result = await executeTool("update_config", { changes: { gmgnApiKey: secret }, reason: "secret-test" });
  } finally {
    console.log = original;
  }
  assert.equal(result.applied.gmgnApiKey, "***redacted***");
  assert.equal(readJson("gmgn-config.json").apiKey, secret);
  assert.equal(lines.join("\n").includes(secret), false);
  assert.equal(readFileSync("lessons.json", "utf8").includes(secret), false);
});

await t("corrupt existing GMGN JSON fails closed before runtime mutation", async () => {
  const runtimeBefore = config.gmgn.interval;
  writeFileSync("gmgn-config.json", "{broken\n");
  const bytesBefore = readFileSync("gmgn-config.json");
  const result = await executeTool("update_config", { changes: { gmgnInterval: "24h" } });
  assert.equal(result.success, false);
  assert.match(result.error, /Invalid gmgn-config\.json/);
  assert.equal(config.gmgn.interval, runtimeBefore);
  assert.deepEqual(readFileSync("gmgn-config.json"), bytesBefore);
  writeFileSync("gmgn-config.json", `${JSON.stringify({ interval: runtimeBefore }, null, 2)}\n`);
});

await t("scalar no-op is byte-idempotent", async () => {
  const before = readFileSync("gmgn-config.json");
  const result = await executeTool("update_config", { changes: { gmgnInterval: config.gmgn.interval } });
  assert.equal(result.noop, true);
  assert.deepEqual(readFileSync("gmgn-config.json"), before);
});

await t("definitions use the three executable fork-live names", () => {
  const source = readFileSync("tools/definitions.js", "utf8");
  for (const key of ["gmgnRequireBullishSt", "gmgnRejectAtBottom", "gmgnRequireAboveSt"]) assert.ok(source.includes(key));
  for (const dead of ["gmgnRequireBullishSupertrend", "gmgnRejectAlreadyAtBottom", "gmgnRequireAboveSupertrend"]) assert.equal(source.includes(dead), false);
});

await t("paper update_config performs ZERO-TX", () => {
  assert.equal(txCalls, 0, `ZERO-TX violated: ${txCalls} transaction call(s)`);
  console.log("ZERO-TX:0");
});

console.log(`\nUPDATE-CONFIG: ${pass}/${pass} lolos`);
