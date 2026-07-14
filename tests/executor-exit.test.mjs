// Gerbang 5.7: tools/executor.js patch 15 — blok 5 exitLiquidityCheck (FASE D langkah 2, MONEY).
//   node tests/executor-exit.test.mjs <path-target>
// Blok 5 di dalam runSafetyChecks module-local (panggil jaringan) → diuji STRUKTURAL (string
// sumber) + FUNGSIONAL via ekstrak-blok murni + AsyncFunction dgn config/args/probe/log
// terkontrol (pola executor-ext strategyLock). NOL fetch/tx nyata.
//   LAPIS 1 (flag OFF = PARITY vanilla — wajib hijau): probe TAK dipanggil, {pass:true}.
//   LAPIS 2 (flag ON = jalur baru): round-trip>maxPct → {pass:false}; probe throw → fail-open.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/executor-exit.test.mjs <path-target>"); process.exit(1); }
const src = readFileSync(join(target, "tools", "executor.js"), "utf8");

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const BASE = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

// ── STRUKTURAL: blok 5 hadir, gated, DRY_RUN guard, fail-open; import; blok 6 absen ──
await t("import quoteSellPriceImpact dari wallet.js (BUKAN swapBaseToSolWithRetry — blok 6 DEFER)", () => {
  assert.ok(/import \{ getWalletBalances, swapToken, quoteSellPriceImpact \} from "\.\/wallet\.js";/.test(src), "import salah");
  assert.ok(!/swapBaseToSolWithRetry.*from "\.\/wallet\.js"/.test(src), "swapBaseToSolWithRetry TAK boleh diimport (bentrok lokal + blok 6 defer)");
});
await t("blok 5 gated config.experiments?.exitLiquidityCheck + guard DRY_RUN + fail-open catch", () => {
  assert.ok(/config\.experiments\?\.exitLiquidityCheck &&/.test(src), "gating flag absen");
  assert.ok(/process\.env\.DRY_RUN !== "true"/.test(src.slice(src.indexOf("exitLiquidityCheck"))), "guard DRY_RUN absen di blok 5");
  assert.ok(/exitLiquidityCheck probe failed — allowing deploy \(fail-open\)/.test(src), "log fail-open absen");
  assert.ok(/await quoteSellPriceImpact\(\{ baseMint: args\.base_mint, solNotional: amountY \}\)/.test(src), "panggilan probe salah");
});
await t("blok 6 auto-swap fork-variant TETAP ABSENT (DEFER)", () => {
  assert.ok(!/swapBaseToSolWithRetry\(\{ base_mint/.test(src), "blok 6 fork-variant bocor");
});

// ── FUNGSIONAL: ekstrak blok 5 murni (komentar→return pass:true), eval terkontrol ──
const iStart = src.indexOf("// ─── 🧪 Experiment #3: exit-liquidity check");
const iRet = src.indexOf("return { pass: true };", iStart);
assert.ok(iStart > 0 && iRet > iStart, "blok 5 tak ter-ekstrak untuk uji fungsional");
const block = src.slice(iStart, iRet + "return { pass: true };".length);

const run = async ({ flag, dryRun = false, probe, maxPct, baseMint = BASE, amountY = 1 }) => {
  const logs = []; let probeCalls = 0;
  const config = { experiments: { exitLiquidityCheck: flag, exitLiquidityMaxSlippagePct: maxPct } };
  const args = { base_mint: baseMint };
  const quoteSellPriceImpact = async (a) => { probeCalls++; if (probe instanceof Error) throw probe; return probe; };
  const log = (tag, msg) => logs.push(`${tag}:${msg}`);
  const prevDry = process.env.DRY_RUN;
  if (dryRun) process.env.DRY_RUN = "true"; else delete process.env.DRY_RUN;
  try {
    const fn = new AsyncFunction("config", "args", "amountY", "quoteSellPriceImpact", "log", block);
    const res = await fn(config, args, amountY, quoteSellPriceImpact, log);
    return { res, logs, probeCalls };
  } finally { if (prevDry === undefined) delete process.env.DRY_RUN; else process.env.DRY_RUN = prevDry; }
};

// LAPIS 1 — flag OFF = PARITY vanilla (probe NOL dipanggil, jalur identik) ──────
await t("LAPIS1: exitLiquidityCheck=false → probe TAK dipanggil, {pass:true} (parity vanilla)", async () => {
  const { res, probeCalls } = await run({ flag: false, probe: { roundTripLossPct: 99 } });
  assert.strictEqual(probeCalls, 0, "probe TIDAK boleh dipanggil saat flag OFF");
  assert.deepStrictEqual(res, { pass: true });
});
await t("LAPIS1: flag=true TAPI DRY_RUN=true (paper) → probe TAK dipanggil, {pass:true}", async () => {
  const { res, probeCalls } = await run({ flag: true, dryRun: true, probe: { roundTripLossPct: 99 }, maxPct: 10 });
  assert.strictEqual(probeCalls, 0, "paper-mode harus skip probe");
  assert.deepStrictEqual(res, { pass: true });
});
await t("LAPIS1: flag=true TAPI base_mint absent → probe TAK dipanggil, {pass:true}", async () => {
  const { res, probeCalls } = await run({ flag: true, baseMint: "", probe: { roundTripLossPct: 99 }, maxPct: 10 });
  assert.strictEqual(probeCalls, 0);
  assert.deepStrictEqual(res, { pass: true });
});

// LAPIS 2 — flag ON = jalur baru ──────────────────────────────────────────────
await t("LAPIS2: flag ON + round-trip 15% > maxPct 10% → DIBLOKIR {pass:false}", async () => {
  const { res, probeCalls } = await run({ flag: true, probe: { roundTripLossPct: 15, impactPct: 5 }, maxPct: 10 });
  assert.strictEqual(probeCalls, 1, "probe harus dipanggil");
  assert.strictEqual(res.pass, false);
  assert.ok(/exit-liquidity/.test(res.reason), "reason blokir absen");
});
await t("LAPIS2: flag ON + round-trip 5% <= maxPct 10% → LANJUT {pass:true} (probe jalan)", async () => {
  const { res, probeCalls } = await run({ flag: true, probe: { roundTripLossPct: 5, impactPct: 1 }, maxPct: 10 });
  assert.strictEqual(probeCalls, 1);
  assert.deepStrictEqual(res, { pass: true });
});
await t("LAPIS2: flag ON + probe THROW → fail-open {pass:true} + log (deploy lanjut)", async () => {
  const { res, logs, probeCalls } = await run({ flag: true, probe: new Error("no route"), maxPct: 10 });
  assert.strictEqual(probeCalls, 1);
  assert.deepStrictEqual(res, { pass: true }, "throw harus fail-open ke pass:true");
  assert.ok(logs.some((l) => /fail-open/.test(l)), "log fail-open absen");
});
await t("LAPIS2: maxPct default 10 saat config absent (round-trip 12 → blokir)", async () => {
  const { res } = await run({ flag: true, probe: { roundTripLossPct: 12, impactPct: 3 }, maxPct: undefined });
  assert.strictEqual(res.pass, false, "default maxPct 10 harus blokir 12%");
});

console.log(`\nexecutor-exit: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
