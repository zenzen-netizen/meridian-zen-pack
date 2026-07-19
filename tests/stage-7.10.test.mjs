// Stage 7.10 money/display gate: bounded index consumers + final PnL display parity.
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [target, pack, forkRepo = "/home/ubuntu/meridianzen"] = process.argv.slice(2);
if (!target || !pack) {
  console.error("pakai: node tests/stage-7.10.test.mjs <path-target> <path-pack> [fork-repo]");
  process.exit(1);
}

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (error) { console.log("  ❌", name, "→", error.message); fail++; }
}

const indexSrc = readFileSync(join(target, "index.js"), "utf8");
const pnlSrc = readFileSync(join(target, "tools/pnl.js"), "utf8");
const configPluginSrc = readFileSync(join(target, "zenpack-plugins/50-config-ext.js"), "utf8");
const forkIndex = execFileSync("git", ["-C", forkRepo, "show", "643e954:index.js"], { encoding: "utf8" });
const forkConfig = execFileSync("git", ["-C", forkRepo, "show", "643e954:config.js"], { encoding: "utf8" });
const forkPnl = execFileSync("git", ["-C", forkRepo, "show", "643e954:tools/pnl.js"], { encoding: "utf8" });

function functionBlock(src, signature) {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `signature hilang: ${signature}`);
  const open = src.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, templateDepth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i], next = src[i + 1];
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (ch === "\\") { escaped = true; continue; }
      if (quote === "`" && ch === "$" && next === "{") { templateDepth++; i++; continue; }
      if (quote === "`" && ch === "}" && templateDepth) { templateDepth--; continue; }
      if (ch === quote && templateDepth === 0) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "/" && next === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (ch === "/" && next === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`block tidak tertutup: ${signature}`);
}

function markerBody(src, name) {
  const startMark = `// >>> zen-pack:${name} >>>`;
  const endMark = `// <<< zen-pack:${name} <<<`;
  const start = src.indexOf(startMark);
  const end = src.indexOf(endMark, start);
  assert.ok(start >= 0 && end > start, `marker hilang: ${name}`);
  return src.slice(src.indexOf("\n", start) + 1, end).trimEnd();
}

const stripMarkers = (src) => src.replace(/^[ \t]*\/\/ [<>]{3} zen-pack:[^\n]*\n/gm, "");

await t("fork default idle cooldown verbatim false/20", () => {
  for (const [line, installedPattern] of [
    ["idleScreeningCooldown:       u.idleScreeningCooldown       ?? false,", /idleScreeningCooldown:\s+u\.idleScreeningCooldown\s+\?\? false,/],
    ["idleScreeningCooldownMin:    u.idleScreeningCooldownMin    ?? 20,", /idleScreeningCooldownMin:\s+u\.idleScreeningCooldownMin\s+\?\? 20,/],
  ]) {
    assert.ok(forkConfig.includes(line), `fork default tidak ditemukan: ${line}`);
    assert.match(configPluginSrc, installedPattern, `installed default drift: ${line}`);
  }
});

await t("golden idle/helper/call match fork verbatim", () => {
  const idle = markerBody(indexSrc, "34-idle-screening-cooldown");
  const helper = markerBody(indexSrc, "34-indicator-helper");
  const call = markerBody(indexSrc, "34-indicator-call");
  assert.ok(forkIndex.includes(idle));
  assert.ok(forkIndex.includes(helper));
  assert.ok(forkIndex.includes(call));
  assert.ok(indexSrc.includes('import { confirmIndicatorPreset } from "./tools/chart-indicators.js";'));
});

await t("indicator helper default-OFF, confirmed, skipped, error", async () => {
  const helperSrc = functionBlock(indexSrc, "async function getIndicatorExitSignal");
  const config = { indicators: { enabled: false, exitEnabled: false } };
  let confirms = 0, warnings = 0;
  const make = (confirmIndicatorPreset) => new Function(
    "config", "confirmIndicatorPreset", "log",
    `${helperSrc}; return getIndicatorExitSignal;`,
  )(config, confirmIndicatorPreset, () => { warnings++; });

  let helper = make(async () => { confirms++; return { enabled: true, confirmed: true }; });
  assert.strictEqual(await helper({ base_mint: "MINT", pair: "T-SOL" }), null);
  assert.strictEqual(confirms, 0);

  config.indicators.enabled = true;
  config.indicators.exitEnabled = true;
  assert.deepStrictEqual(await helper({ base_mint: "MINT", pair: "T-SOL" }), {
    action: "CLOSE", rule: "indicator", reason: "exit preset confirmed",
  });
  helper = make(async () => ({ enabled: true, confirmed: true, skipped: true }));
  assert.strictEqual(await helper({ base_mint: "MINT", pair: "T-SOL" }), null);
  helper = make(async () => { throw new Error("fixture"); });
  assert.strictEqual(await helper({ base_mint: "MINT", pair: "T-SOL" }), null);
  assert.strictEqual(warnings, 1);
});

await t("hard rule > indicator > claim precedence", async () => {
  const start = indexSrc.indexOf("    const actionMap = new Map();");
  const loopStart = indexSrc.indexOf("    for (const p of positionData) {", start);
  const loop = functionBlock(indexSrc.slice(loopStart), "for (const p of positionData)");
  const body = `${indexSrc.slice(start, loopStart)}${loop}\nreturn actionMap;`;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction(
    "positionData", "exitMap", "config", "getDeterministicCloseRule", "getIndicatorExitSignal",
    body,
  );
  const p = { position: "paper_indicator", unclaimed_fees_usd: 10 };
  const config = { management: { minClaimAmount: 5 } };
  let indicatorCalls = 0;
  let out = await run([p], new Map(), config, () => ({ action: "CLOSE", rule: 1, reason: "stop loss" }), async () => { indicatorCalls++; });
  assert.strictEqual(out.get(p.position).rule, 1);
  assert.strictEqual(indicatorCalls, 0);
  out = await run([p], new Map(), config, () => null, async () => ({ action: "CLOSE", rule: "indicator", reason: "confirmed" }));
  assert.strictEqual(out.get(p.position).rule, "indicator");
  out = await run([p], new Map(), config, () => null, async () => null);
  assert.strictEqual(out.get(p.position).action, "CLAIM");
});

await t("paper indicator close routes once through executeTool; ZERO-TX", async () => {
  const branch = functionBlock(indexSrc, 'if (act.action === "CLOSE")');
  const branchBody = branch.slice(branch.indexOf("{") + 1, -1);
  let toolCalls = 0, txCount = 0;
  const executeTool = async (name, args) => {
    toolCalls++;
    assert.strictEqual(name, "close_position");
    assert.strictEqual(args.reason, "indicator confirmed");
    return { success: true, paper: true, txs: [] };
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction(
    "p", "act", "liveMessage", "executeTool",
    `const lines = []; ${branchBody}; return lines.join("\\n");`,
  );
  const p = { position: "paper_indicator", pair: "PAPER-SOL" };
  const report = await execute(p, {
    action: "CLOSE", rule: "indicator", reason: "indicator confirmed",
  }, null, executeTool);
  assert.strictEqual(toolCalls, 1);
  assert.strictEqual(txCount, 0);
  assert.ok(report.includes("closed (indicator confirmed)"));
});

await t("idle OFF triggers; ON throttles; expiry/error fail-open", async () => {
  const block = functionBlock(indexSrc, "if (positions.length === 0)");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction(
    "positions", "config", "_screeningLastTriggered", "log", "runScreeningCycle",
    `let mgmtReport = null; ${block}; return mgmtReport;`,
  );
  const now = Date.now();
  let screens = 0;
  const screen = async () => { screens++; };
  const config = { experiments: { idleScreeningCooldown: false, idleScreeningCooldownMin: 20 } };
  assert.strictEqual(await run([], config, now, () => {}, screen), "🔍 No open positions — triggering screening.");
  assert.strictEqual(screens, 1);
  config.experiments.idleScreeningCooldown = true;
  assert.strictEqual(await run([], config, now - 5 * 60_000, () => {}, screen), "💤 No open positions — idle screening on cooldown.");
  assert.strictEqual(screens, 1);
  assert.strictEqual(await run([], config, now - 21 * 60_000, () => {}, screen), "🔍 No open positions — triggering screening.");
  assert.strictEqual(screens, 2);
  const bad = { experiments: new Proxy({}, { get() { throw new Error("fixture"); } }) };
  assert.strictEqual(await run([], bad, now, () => {}, screen), "🔍 No open positions — triggering screening.");
  assert.strictEqual(screens, 3);
});

await t("tools/pnl normalized full-file equals fork; PnL math unchanged", () => {
  assert.strictEqual(stripMarkers(pnlSrc), forkPnl);
  const basePnl = readFileSync(join(target, ".zenpack/backups/tools/pnl.js.orig"), "utf8");
  const formula = (src) => {
    const fn = functionBlock(src, "function buildPosition");
    return fn.slice(fn.indexOf("  const priceX"), fn.indexOf("  const tracked"));
  };
  assert.strictEqual(formula(pnlSrc), formula(basePnl));
});

await t("vanilla 2-tick poller remains byte-identical", () => {
  const base = readFileSync(join(target, ".zenpack/backups/index.js.orig"), "utf8");
  const poller = (src) => {
    const start = src.indexOf("  // Fast PnL poller");
    const end = src.indexOf("  }, pnlPollMs);", start) + "  }, pnlPollMs);".length;
    return src.slice(start, end);
  };
  assert.strictEqual(poller(indexSrc), poller(base));
});

console.log(`\nstage-7.10: ${pass} pass, ${fail} fail · ZERO-TX`);
process.exit(fail ? 1 : 0);
