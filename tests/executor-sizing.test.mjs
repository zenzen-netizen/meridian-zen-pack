// Gerbang 5.5: zenpack-lib/sizing.js — minDeployAmount + applyConvictionSizing (verbatim fork).
//   node tests/executor-sizing.test.mjs <path-target>
// Fungsi baca binding hidup `config` dari ../config.js. Di test kita EVAL badan fungsi dari
// SUMBER target (buang import + export) lalu suntik `config` mock terkontrol per-kasus → uji
// murni matematika clamp tanpa efek-samping config.js. Properti inti money: hasil sizing TAK
// PERNAH tembus [deployAmountSol(floor), maxDeployAmount(ceil)]; floor min-deploy = 0.03 (fork).
import { join } from "node:path";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/executor-sizing.test.mjs <path-target>"); process.exit(1); }

const src = readFileSync(join(target, "zenpack-lib", "sizing.js"), "utf8");
// Buang baris import config + kata kunci export → jadikan badan yang bisa di-Function-wrap.
const body = src.replace(/^import[^\n]*\n/m, "").replace(/export\s+/g, "");
// Pabrik: suntik `config` per-kasus, kembalikan fungsi sizing.
const make = (config) =>
  new Function("config", body + "\n; return { minDeployAmount, computeDeployAmount, applyConvictionSizing };")(config);

const baseCfg = (over = {}) => ({
  management: { deployAmountSol: 0.5, gasReserve: 0.2, positionSizePct: 0.35, sizingMode: "fixed", rentPerPositionSol: 0, ...(over.management || {}) },
  risk: { maxDeployAmount: 2.0, maxPositions: 3, ...(over.risk || {}) },
  experiments: over.experiments,
});

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

// ── minDeployAmount (floor 0.03 fork) ───────────────────────────────────────
t("minDeployAmount: deployAmountSol=0.5 → 0.5 (di atas floor)", () => {
  const { minDeployAmount } = make(baseCfg());
  assert.strictEqual(minDeployAmount(), 0.5);
});
t("minDeployAmount: deployAmountSol=0.01 → 0.03 (floor fork, BUKAN 0.1 lama)", () => {
  const { minDeployAmount } = make(baseCfg({ management: { deployAmountSol: 0.01 } }));
  assert.strictEqual(minDeployAmount(), 0.03);
});
t("minDeployAmount: deployAmountSol undefined → 0.03 (fallback ??)", () => {
  const { minDeployAmount } = make(baseCfg({ management: { deployAmountSol: undefined } }));
  assert.strictEqual(minDeployAmount(), 0.03);
});

// ── computeDeployAmount: fixed parity + maximize adaptive slots ─────────────
t("fixed fixture: 2 SOL → vanilla 0.63, slotsRemaining diabaikan", () => {
  const { computeDeployAmount } = make(baseCfg());
  assert.strictEqual(computeDeployAmount(2, { slotsRemaining: 1 }), 0.63);
  assert.strictEqual(computeDeployAmount(2, { slotsRemaining: 3 }), 0.63);
});
t("maximize fixture: pilih 3 slot terbesar yang tetap ≥ floor", () => {
  const cfg = baseCfg({ management: { sizingMode: "maximize", rentPerPositionSol: 0.057 } });
  const { computeDeployAmount } = make(cfg);
  assert.strictEqual(computeDeployAmount(2, { slotsRemaining: 3 }), 0.543);
});
t("maximize fixture: 3 slot gagal floor lalu adapt ke 2 slot", () => {
  const cfg = baseCfg({ management: { sizingMode: "maximize", rentPerPositionSol: 0.057 } });
  const { computeDeployAmount } = make(cfg);
  assert.strictEqual(computeDeployAmount(1.5, { slotsRemaining: 3 }), 0.593);
});
t("maximize modal kurang: satu slot pun di bawah floor → 0", () => {
  const cfg = baseCfg({ management: { sizingMode: "maximize", rentPerPositionSol: 0.057 } });
  const { computeDeployAmount } = make(cfg);
  assert.strictEqual(computeDeployAmount(0.75, { slotsRemaining: 1 }), 0);
});
t("maximize tidak round-up dan clamp maxDeployAmount", () => {
  const cfg = baseCfg({ management: { sizingMode: "maximize", rentPerPositionSol: 0 }, risk: { maxDeployAmount: 0.55 } });
  const { computeDeployAmount } = make(cfg);
  assert.strictEqual(computeDeployAmount(2, { slotsRemaining: 3 }), 0.55);
});

// ── applyConvictionSizing: experiment OFF/absent = unchanged ─────────────────
t("conviction OFF (experiments absen) → input unchanged", () => {
  const { applyConvictionSizing } = make(baseCfg());
  assert.strictEqual(applyConvictionSizing(1.0, "high"), 1.0);
});
t("conviction ON tapi flag false → unchanged", () => {
  const { applyConvictionSizing } = make(baseCfg({ experiments: { convictionSizing: false } }));
  assert.strictEqual(applyConvictionSizing(1.0, "high"), 1.0);
});

// ── applyConvictionSizing: ON, nudges + clamp ───────────────────────────────
const onCfg = (adj = 30, floor = 0.5, ceil = 2.0) =>
  baseCfg({ management: { deployAmountSol: floor }, risk: { maxDeployAmount: ceil },
            experiments: { convictionSizing: true, convictionSizingMaxAdjustPct: adj } });

t("conviction high ON → amt × 1.3 (dalam rail)", () => {
  const { applyConvictionSizing } = make(onCfg(30));
  assert.strictEqual(applyConvictionSizing(1.0, "high"), 1.3);
});
t("conviction low ON → amt × 0.7 (dalam rail)", () => {
  const { applyConvictionSizing } = make(onCfg(30));
  assert.strictEqual(applyConvictionSizing(1.0, "low"), 0.7);
});
t("conviction medium ON → unchanged (mult 1.0)", () => {
  const { applyConvictionSizing } = make(onCfg(30));
  assert.strictEqual(applyConvictionSizing(1.0, "medium"), 1.0);
});
t("conviction missing ON → unchanged", () => {
  const { applyConvictionSizing } = make(onCfg(30));
  assert.strictEqual(applyConvictionSizing(1.0, undefined), 1.0);
});

// ── CLAMP inti: TAK PERNAH tembus [floor, ceil] ─────────────────────────────
t("CLAMP high: amt dekat ceil, high tak tembus maxDeployAmount", () => {
  // floor 0.5, ceil 2.0, adj 100% → 1.8 × 2 = 3.6 → clamp ke 2.0
  const { applyConvictionSizing } = make(onCfg(100, 0.5, 2.0));
  assert.strictEqual(applyConvictionSizing(1.8, "high"), 2.0);
});
t("CLAMP low: amt dekat floor, low tak jebol di bawah deployAmountSol", () => {
  // floor 0.5, adj 100% → 0.6 × 0 = 0 → clamp ke floor 0.5
  const { applyConvictionSizing } = make(onCfg(100, 0.5, 2.0));
  assert.strictEqual(applyConvictionSizing(0.6, "low"), 0.5);
});
t("CLAMP fuzz: 200 kasus acak high/low tetap ∈ [floor, ceil]", () => {
  const floor = 0.5, ceil = 2.0;
  const { applyConvictionSizing } = make(onCfg(50, floor, ceil));
  for (let i = 0; i < 200; i++) {
    const amt = 0.5 + Math.random() * 1.5; // ∈ [floor, ceil]
    const conv = Math.random() < 0.5 ? "high" : "low";
    const out = applyConvictionSizing(amt, conv);
    assert.ok(out >= floor - 1e-9 && out <= ceil + 1e-9, `tembus rail: amt=${amt} ${conv} → ${out}`);
  }
});

// ── fail-safe input jelek ────────────────────────────────────────────────────
t("input non-finite → kembalikan input apa adanya (fail-safe)", () => {
  const { applyConvictionSizing } = make(onCfg(30));
  assert.strictEqual(applyConvictionSizing(NaN, "high"), NaN);
  assert.strictEqual(applyConvictionSizing("x", "high"), "x");
});
t("input <= 0 → kembalikan input apa adanya", () => {
  const { applyConvictionSizing } = make(onCfg(30));
  assert.strictEqual(applyConvictionSizing(0, "high"), 0);
  assert.strictEqual(applyConvictionSizing(-1, "high"), -1);
});

console.log(`\nsizing: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
