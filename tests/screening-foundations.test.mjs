import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/screening-foundations.test.mjs <path-target>"); process.exit(1); }
process.chdir(target);
process.env.DRY_RUN = "true";
process.env.OPENROUTER_API_KEY ||= "dummy";
process.env.WALLET_PRIVATE_KEY ||= "11111111111111111111111111111111";
process.env.RPC_URL ||= "http://127.0.0.1:8899";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (e) { console.log("  ❌", name, "→", e.message); fail++; }
}

const gmgn = await import(pathToFileURL(join(target, "tools/gmgn.js")).href);
const cache = await import(pathToFileURL(join(target, "zenpack-lib/candidate-cache.js")).href);
const money = await import(pathToFileURL(join(target, "zenpack-plugins/70-money-commands.js")).href);

await t("bounded GMGN producer and formatter exports live", () => {
  assert.strictEqual(typeof gmgn.discoverGmgnPools, "function");
  assert.strictEqual(typeof gmgn.formatGmgnCandidateForPrompt, "function");
  assert.strictEqual(typeof gmgn.getGmgnTokenFees, "function");
  assert.strictEqual(typeof gmgn.hasGmgnApiKey, "function");
  const out = gmgn.formatGmgnCandidateForPrompt({
    name: "FIX/SOL", launchpad: "pump", token_age_hours: 2, mcap: 100_000,
    bin_step: 80, tvl: 20_000, fee_active_tvl_ratio: 0.2,
    volume_window: 50_000, volatility: 1.25, holders: 900,
    gmgn_total_fee_sol: 40, gmgn_smart_wallets: 2, gmgn_kol_wallets: 1,
  });
  assert.ok(out.includes("FIX/SOL | pump | age=2h | mcap=$100k | bin_step=80"));
  assert.ok(out.includes("volatility=1.25"));
  assert.ok(out.includes("smart=2"));
});

await t("getTopCandidates has GMGN dispatch and funnel metadata", () => {
  const src = readFileSync(join(target, "tools/screening.js"), "utf8");
  assert.ok(src.includes('import { discoverGmgnPools } from "./gmgn.js";'));
  assert.ok(src.includes('source === "gmgn"'));
  assert.ok(src.includes("stage_counts: discovery.stage_counts"));
  assert.ok(src.includes("all_filtered: filteredOut"));
  assert.ok(src.includes("export function degenScore"), "owner deviation degenScore must remain");
});

await t("Plugin 70 and core source use one shared cache", () => {
  money.__test.reset();
  money.__test.setLatestCandidates([{ name: "ONE", pool: "P1" }]);
  assert.deepStrictEqual(cache.getLatestCandidatesMeta().candidates.map((p) => p.pool), ["P1"]);
  cache.setLatestCandidates([{ name: "TWO", pool: "P2" }]);
  assert.ok(money.__test.describeLatestCandidates().includes("TWO"));
  const core = readFileSync(join(target, "index.js"), "utf8");
  assert.ok(core.includes('from "./zenpack-lib/candidate-cache.js"'));
  assert.ok(!core.includes("let _latestCandidates = []"));
  assert.ok(!core.includes("let _latestCandidatesAt = null"));
});

console.log(`\nscreening-foundations: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
