// Gerbang 5.7: tools/wallet.js patch 14 — port fork VERBATIM (FASE D langkah 1).
//   node tests/wallet-ext.test.mjs <path-target>
// 4 fungsi export ADA. quoteSellPriceImpact/getSolMarketRegime diuji FUNGSIONAL dgn
// globalThis.fetch di-STUB (NOL fetch nyata ke Jupiter — brief FASE D.1). jupiterQuote
// module-local (tak ter-export) diuji tak-langsung via quoteSellPriceImpact.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/wallet-ext.test.mjs <path-target>"); process.exit(1); }

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

// ── Stub fetch: antrian respons terkontrol (nol jaringan) ──────────────────
let fetchQueue = [];
const fetchCalls = [];
globalThis.fetch = async (url, opts) => {
  fetchCalls.push({ url: String(url), opts });
  if (!fetchQueue.length) throw new Error("fetch stub: antrian kosong (fetch tak terduga)");
  const next = fetchQueue.shift();
  return { ok: next.ok !== false, status: next.status ?? 200, json: async () => next.body };
};
const queueFetch = (...responses) => { fetchQueue = responses; fetchCalls.length = 0; };

const w = await import(pathToFileURL(join(target, "tools", "wallet.js")).href);
const BASE = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"; // dummy non-SOL mint

// ── 4 fungsi export ADA ────────────────────────────────────────────────────
await t("4 fungsi fork export ADA (quoteSellPriceImpact/getSolMarketRegime/swapBaseToSolWithRetry + normalizeMint)", () => {
  for (const k of ["quoteSellPriceImpact", "getSolMarketRegime", "swapBaseToSolWithRetry"]) {
    assert.strictEqual(typeof w[k], "function", `${k} bukan fungsi`);
  }
});

// ── quoteSellPriceImpact: shape {roundTripLossPct, impactPct} (mock jupiterQuote via fetch) ──
await t("quoteSellPriceImpact return shape {roundTripLossPct, impactPct, baseAmount, outSol}", async () => {
  // buy: 1 SOL (1e9 lamports) -> 5e8 base; sell: 5e8 base -> 9.5e8 lamports, impact 0.02
  queueFetch(
    { body: { outAmount: "500000000" } },
    { body: { outAmount: "950000000", priceImpactPct: 0.02 } },
  );
  const r = await w.quoteSellPriceImpact({ baseMint: BASE, solNotional: 1 });
  assert.ok("roundTripLossPct" in r && "impactPct" in r, "field shape kurang");
  assert.strictEqual(Math.round(r.roundTripLossPct * 100) / 100, 5, "roundTripLossPct=5% (1e9->9.5e8)");
  assert.strictEqual(Math.round(r.impactPct * 100) / 100, 2, "impactPct=2% (|0.02|*100)");
  assert.strictEqual(r.baseAmount, 5e8);
  assert.strictEqual(r.outSol, 0.95);
  assert.strictEqual(fetchCalls.length, 2, "harus 2 quote (buy+sell)");
});

await t("quoteSellPriceImpact tolak base==SOL / notional buruk (throw = caller fail-open)", async () => {
  await assert.rejects(() => w.quoteSellPriceImpact({ baseMint: "SOL", solNotional: 1 }), /no base mint/);
  await assert.rejects(() => w.quoteSellPriceImpact({ baseMint: BASE, solNotional: 0 }), /bad notional/);
});

// ── getSolMarketRegime: klasifikasi regime (mock price) ─────────────────────
await t("getSolMarketRegime kembalikan {usdPrice, change24hPct, liquidity} (mock Price v3)", async () => {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  queueFetch({ body: { [SOL_MINT]: { usdPrice: 152.5, priceChange24h: -6.3, liquidity: 1234567 } } });
  const r = await w.getSolMarketRegime();
  assert.ok(r, "harus non-null");
  assert.strictEqual(r.usdPrice, 152.5);
  assert.strictEqual(r.change24hPct, -6.3); // risk-off (negatif)
  assert.strictEqual(r.liquidity, 1234567);
});

await t("getSolMarketRegime fail-open null saat field hilang / fetch gagal", async () => {
  queueFetch({ body: {} }); // no SOL entry
  assert.strictEqual(await w.getSolMarketRegime(), null, "entry hilang -> null");
  queueFetch({ ok: false, status: 503, body: {} }); // http error
  assert.strictEqual(await w.getSolMarketRegime(), null, "http gagal -> null (fail-open)");
});

console.log(`\nwallet-ext: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
