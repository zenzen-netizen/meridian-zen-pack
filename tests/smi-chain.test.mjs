// Gerbang 5.8: tools/chart-indicators.js patch 17 + tools/smi.js drop-in.
//   node tests/smi-chain.test.mjs <path-target>
// NOL jaringan: chart-indicators API di-stub dengan payload candle deterministik.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/smi-chain.test.mjs <path-target>"); process.exit(1); }
process.chdir(target);

const { config } = await import(pathToFileURL(join(target, "config.js")).href);
const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
await loadPlugins(join(target, "zenpack-plugins"), hooks);

const smi = await import(pathToFileURL(join(target, "tools", "smi.js")).href);
const chart = await import(`${pathToFileURL(join(target, "tools", "chart-indicators.js")).href}?t=${Date.now()}`);

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

const candles = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((close) => ({
  high: close + 1,
  low: close - 1,
  close,
}));

const payload = {
  latest: {
    candle: { close: 10 },
    previousCandle: { close: 9 },
    rsi: { value: 45 },
    bollinger: { lower: 6, middle: 9, upper: 12 },
    supertrend: { value: 8, direction: "bullish" },
    states: { supertrendBreakUp: true },
    fibonacci: { levels: { "0.500": 9, "0.618": 8, "0.786": 7 } },
  },
  candles,
};

function stubChartFetch() {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };
  return calls;
}

await t("config SMI keys dari config-ext tersedia", () => {
  assert.strictEqual(config.indicators.smiPdLookback, 5);
  assert.strictEqual(config.indicators.smiPaLookback, 3);
  assert.strictEqual(config.indicators.smiCrossWindow, 3);
});

await t("evaluateSmi callable dan fixture deterministik confirmed PathB", () => {
  const res = smi.evaluateSmi(candles, {
    pdLookback: config.indicators.smiPdLookback,
    paLookback: config.indicators.smiPaLookback,
    crossWindow: config.indicators.smiCrossWindow,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.confirmed, true);
  assert.strictEqual(res.pathB, true);
});

await t("fetchChartIndicatorsForMint exported dead export, callable via stub", async () => {
  const calls = stubChartFetch();
  const res = await chart.fetchChartIndicatorsForMint("mint_fixture", { interval: "15_MINUTE" });
  assert.deepStrictEqual(res.latest.candle, payload.latest.candle);
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].includes("/chart-indicators/mint_fixture?"));
});

await t("confirmIndicatorPreset supertrend_plus_smi memakai SMI config dan confirms", async () => {
  Object.assign(config.indicators, {
    enabled: true,
    entryPreset: "supertrend_plus_smi",
    intervals: ["15_MINUTE"],
    requireAllIntervals: false,
  });
  stubChartFetch();
  const res = await chart.confirmIndicatorPreset({ mint: "mint_fixture", side: "entry" });
  assert.strictEqual(res.enabled, true);
  assert.strictEqual(res.confirmed, true);
  assert.strictEqual(res.preset, "supertrend_plus_smi");
  assert.match(res.intervals[0].reason, /Supertrend .* SMI PathB/);
});

console.log(`\nsmi-chain: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
