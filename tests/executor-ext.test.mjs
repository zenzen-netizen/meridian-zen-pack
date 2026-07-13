// Gerbang 5.5: tools/executor.js patch 12 — 5 blok money/display (FASE B/C).
//   node tests/executor-ext.test.mjs <path-target>
// runSafetyChecks module-local + panggil jaringan (validateDeployPoolThresholds/getWallet/
// getMyPositions) → blok diuji STRUKTURAL (string sumber) + strategyLock override diuji
// FUNGSIONAL via eval blok murni dgn config/args/log terkontrol. Properti inti money (owner
// "wajib hijau"): lock terkunci meng-override strategy yang diminta; lock=default TAK sentuh.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/executor-ext.test.mjs <path-target>"); process.exit(1); }
const src = readFileSync(join(target, "tools", "executor.js"), "utf8");

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

// ── STRUKTURAL: 5 blok hadir ────────────────────────────────────────────────
t("import sizing.js (minDeployAmount + applyConvictionSizing) dari zenpack-lib", () => {
  assert.ok(/import \{ minDeployAmount, applyConvictionSizing \} from "\.\.\/zenpack-lib\/sizing\.js";/.test(src));
});
t("blok 2 strategyLock override hadir di case deploy", () => {
  assert.ok(/const stratLock = config\.strategy\?\.strategyLock \?\? "default";/.test(src));
  assert.ok(/if \(stratLock !== "default" && args\.strategy !== stratLock\)/.test(src));
});
t("blok 3 conviction: applyConvictionSizing mutasi args.amount_y", () => {
  assert.ok(/const adjustedAmt = applyConvictionSizing\(originalAmt, args\.conviction\);/.test(src));
  assert.ok(/args\.amount_y = adjustedAmt;/.test(src));
});
t("blok 4a minDeployAmount() (floor 0.03 fork, bukan Math.max(0.1,...))", () => {
  assert.ok(/const minDeploy = minDeployAmount\(\);/.test(src));
  assert.ok(!/Math\.max\(0\.1, config\.management\.deployAmountSol\)/.test(src), "floor lama 0.1 masih ada");
});
t("blok 4b rentReserve masuk minRequired + rentNote", () => {
  assert.ok(/const rentReserve = Math\.max\(0, config\.management\.rentPerPositionSol \?\? 0\);/.test(src));
  assert.ok(/const minRequired = amountY \+ gasReserve \+ rentReserve;/.test(src));
});
t("blok 7 notifyClose bawa peakPnlPct + recorded_pnl fallback + feesUsd", () => {
  assert.ok(/peakPnlPct: result\.peak_pnl_pct \?\? null/.test(src));
  assert.ok(/pnlUsd: result\.recorded_pnl_usd \?\? result\.pnl_usd \?\? 0/.test(src));
  assert.ok(/feesUsd: result\.fees_earned_usd \?\? null/.test(src));
});

// ── STRUKTURAL negatif: blok DEFER absen ────────────────────────────────────
t("blok 5 exitLiquidityCheck ABSENT (DEFER 5.7)", () => {
  assert.ok(!/exitLiquidityCheck/.test(src), "blok 5 bocor");
  assert.ok(!/quoteSellPriceImpact/.test(src), "dep blok 5 bocor");
});
t("blok 6 auto-swap fork-variant ABSENT (DEFER 5.7)", () => {
  assert.ok(!/swapBaseToSolWithRetry\(\{ base_mint/.test(src), "blok 6 fork-variant bocor");
});

// ── STRUKTURAL urutan: strategyLock & conviction sebelum deployAmountY dibaca ──
t("urutan: strategyLock & conviction MENDAHULUI const deployAmountY", () => {
  const iLock = src.indexOf("const stratLock = config.strategy");
  const iConv = src.indexOf("const adjustedAmt = applyConvictionSizing");
  const iAmt  = src.indexOf("const deployAmountY = Number(args.amount_y");
  assert.ok(iLock > 0 && iConv > 0 && iAmt > 0, "anchor hilang");
  assert.ok(iLock < iConv && iConv < iAmt, `urutan salah: lock=${iLock} conv=${iConv} amt=${iAmt}`);
});

// ── FUNGSIONAL strategyLock override (MONEY — wajib hijau) ───────────────────
// Ekstrak blok murni dari sumber, eval dgn config/args/log terkontrol.
const lockBlock = src.match(/const stratLock = config\.strategy\?\.strategyLock[\s\S]*?args\.strategy = stratLock;\s*\n\s*}/);
assert.ok(lockBlock, "blok strategyLock tak ter-ekstrak untuk uji fungsional");
const runLock = (strategyLock, argsStrategy) => {
  const logs = [];
  const config = { strategy: { strategyLock } };
  const args = argsStrategy === undefined ? {} : { strategy: argsStrategy };
  const log = (tag, msg) => logs.push(`${tag}:${msg}`);
  new Function("config", "args", "log", lockBlock[0])(config, args, log);
  return { strategy: args.strategy, logs };
};

t("lock=spot + strategy=curve → override ke spot + log 'overridden'", () => {
  const r = runLock("spot", "curve");
  assert.strictEqual(r.strategy, "spot");
  assert.ok(r.logs.some((l) => /overridden/.test(l)), "log override absen");
});
t("lock=default + strategy=curve → TAK disentuh, nol log", () => {
  const r = runLock("default", "curve");
  assert.strictEqual(r.strategy, "curve");
  assert.strictEqual(r.logs.length, 0);
});
t("lock=spot + strategy=spot (sudah cocok) → nol log override", () => {
  const r = runLock("spot", "spot");
  assert.strictEqual(r.strategy, "spot");
  assert.strictEqual(r.logs.length, 0);
});
t("lock=bid_ask + strategy absent → set ke bid_ask, nol log (args.strategy falsy)", () => {
  const r = runLock("bid_ask", undefined);
  assert.strictEqual(r.strategy, "bid_ask");
  assert.strictEqual(r.logs.length, 0, "tak boleh log kalau strategy asal kosong");
});

console.log(`\nexecutor-ext: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
