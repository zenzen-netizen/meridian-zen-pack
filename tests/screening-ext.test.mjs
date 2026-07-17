// Gerbang 5.8: tools/screening.js patch 16.
//   node tests/screening-ext.test.mjs <path-target>
// Uji multi-category Meteora discovery tanpa jaringan: fetch di-stub, threshold dibuat longgar.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/screening-ext.test.mjs <path-target>"); process.exit(1); }
process.chdir(target);

const { config } = await import(pathToFileURL(join(target, "config.js")).href);
const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
await loadPlugins(join(target, "zenpack-plugins"), hooks);

const screening = await import(`${pathToFileURL(join(target, "tools", "screening.js")).href}?t=${Date.now()}`);

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

function pool(id, symbol = id.toUpperCase()) {
  return {
    pool_address: `pool_${id}`,
    name: `${symbol}/SOL`,
    pool_type: "dlmm",
    dlmm_params: { bin_step: 100 },
    tvl: 50_000,
    active_tvl: 40_000,
    fee: 120,
    volume: 20_000,
    fee_active_tvl_ratio: 0.12,
    volatility: 0.42,
    fee_pct: 1,
    base_token_holders: 1200,
    base_token_has_critical_warnings: false,
    quote_token_has_critical_warnings: false,
    base_token_has_high_single_ownership: false,
    token_x: {
      symbol,
      address: `mint_${id}`,
      market_cap: 500_000,
      organic_score: 88,
      warnings: [],
    },
    token_y: {
      symbol: "SOL",
      address: "So11111111111111111111111111111111111111112",
      organic_score: 90,
    },
  };
}

function relaxConfig() {
  Object.assign(config.screening, {
    timeframe: "30m",
    category: "trending",
    useDiscordSignals: false,
    excludeHighSupplyConcentration: false,
    minMcap: 1,
    maxMcap: 10_000_000,
    minHolders: 1,
    minVolume: 1,
    minTvl: 1,
    maxTvl: null,
    minBinStep: 1,
    maxBinStep: 10_000,
    minFeeActiveTvlRatio: 0,
    minOrganic: 0,
    minQuoteOrganic: 0,
    minTokenAgeHours: null,
    maxTokenAgeHours: null,
    allowedLaunchpads: [],
    blockedLaunchpads: [],
  });
}

function stubDiscovery(map) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(String(url));
    const category = u.searchParams.get("category");
    calls.push({ url: String(url), category });
    const value = map[category];
    if (value instanceof Error) {
      return { ok: false, status: 503, statusText: value.message, json: async () => ({}) };
    }
    return { ok: true, status: 200, statusText: "OK", json: async () => ({ total: value.length, data: value }) };
  };
  return calls;
}

await t("multi-category: fetch per kategori, merge dedupe by pool_address", async () => {
  relaxConfig();
  config.screening.categories = ["trending", "new"];
  const calls = stubDiscovery({
    trending: [pool("a", "AAA")],
    new: [pool("a", "AAA_DUP"), pool("b", "BBB")],
  });
  const res = await screening.discoverPools();
  assert.deepStrictEqual(calls.map((c) => c.category), ["trending", "new"]);
  assert.deepStrictEqual(res.pools.map((p) => p.pool).sort(), ["pool_a", "pool_b"]);
  assert.strictEqual(res.total, 2);
});

await t("multi-category: satu kategori gagal → fail-open kategori lain lanjut", async () => {
  relaxConfig();
  config.screening.categories = ["trending", "broken"];
  const calls = stubDiscovery({
    trending: [pool("a", "AAA")],
    broken: new Error("fixture down"),
  });
  const res = await screening.discoverPools();
  assert.deepStrictEqual(calls.map((c) => c.category), ["trending", "broken"]);
  assert.deepStrictEqual(res.pools.map((p) => p.pool), ["pool_a"]);
  assert.strictEqual(res.total, 1);
});

await t("single/null/empty categories: pakai config.screening.category saja", async () => {
  relaxConfig();
  for (const cats of [null, []]) {
    config.screening.categories = cats;
    const calls = stubDiscovery({ trending: [pool("a", "AAA")] });
    const res = await screening.discoverPools();
    assert.deepStrictEqual(calls.map((c) => c.category), ["trending"]);
    assert.deepStrictEqual(res.pools.map((p) => p.pool), ["pool_a"]);
  }
});

await t("degenScore tetap export + callable; scoreCandidate tidak diekspor", () => {
  assert.strictEqual(typeof screening.degenScore, "function");
  assert.ok(screening.degenScore({
    active_tvl: 50_000,
    volume_active_tvl_ratio: 20,
    fee_active_tvl_ratio: 0.2,
    unique_lps: 20,
    positions_created: 20,
  }, config.opportunity) > 0);
  assert.strictEqual("scoreCandidate" in screening, false);
});

console.log(`\nscreening-ext: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
