// Gerbang 5.1: plugin 50-config-ext menyuntik key custom fork ke objek `config`
// vanilla + hook config:reload (patch 08) + DRY_RUN user-config-wins (patch 09).
//   node tests/config-ext.test.mjs <path-target>
// Semua nilai default di-assert == fork-ref (fixture SENGAJA bukan angka live).
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/config-ext.test.mjs <path-target>"); process.exit(1); }
process.chdir(target);

const ucPath = join(target, "user-config.json");
const bkPath = join(target, "user-config.json.zenpack-cfgext-bak");
const hadUC = existsSync(ucPath);
if (hadUC) copyFileSync(ucPath, bkPath);
function restore() {
  if (hadUC) copyFileSync(bkPath, ucPath);
  else if (existsSync(ucPath)) unlinkSync(ucPath);
  if (existsSync(bkPath)) unlinkSync(bkPath);
}

// user-config KOSONG → semua key custom ambil DEFAULT fork.
writeFileSync(ucPath, "{}");

const { config, reloadScreeningThresholds } = await import(pathToFileURL(join(target, "config.js")).href);
const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);

const res = await loadPlugins(join(target, "zenpack-plugins"), hooks);
console.log(`loader: loaded ${res.loaded.length}, skipped ${res.skipped.length}, errors ${res.errors.length}`);
for (const e of res.errors) console.error("  plugin error:", e.file, e.err);

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

await t("loader: 9 plugin loaded, 0 skipped, 0 errors", () => {
  assert.strictEqual(res.loaded.length, 9); // +80-briefing-orch
  assert.strictEqual(res.skipped.length, 0);
  assert.strictEqual(res.errors.length, 0);
});

// Tabel key custom → nilai default fork (fork-ref config.js).
await t("top-level: profile/activeSetup/promptNotes default fork", () => {
  assert.strictEqual(config.profile, "moderate");
  assert.strictEqual(config.activeSetup, null);
  assert.deepStrictEqual(config.promptNotes, { screener: [], manager: [], general: [] });
});

await t("screening.categories default null", () => {
  assert.strictEqual(config.screening.categories, null);
});

await t("management gasReserveAutoTune/BufferDays/FloorSol + sizingMode + rentPerPositionSol", () => {
  const m = config.management;
  assert.strictEqual(m.gasReserveAutoTune, false);
  assert.strictEqual(m.gasReserveBufferDays, 14);
  assert.strictEqual(m.gasReserveFloorSol, 0.03);
  assert.strictEqual(m.sizingMode, "fixed");
  assert.strictEqual(m.rentPerPositionSol, 0);
});

await t("strategy strategyLock + dualSide*", () => {
  const st = config.strategy;
  assert.strictEqual(st.strategyLock, "default");
  assert.strictEqual(st.dualSideEnabled, false);
  assert.strictEqual(st.dualSideTokenPct, 10);
  assert.strictEqual(st.dualSideUpsidePct, 15);
  assert.strictEqual(st.dualSideStrategy, "bid_ask");
});

await t("schedule adaptiveScreening + maxScreeningIntervalMin", () => {
  assert.strictEqual(config.schedule.adaptiveScreening, false);
  assert.strictEqual(config.schedule.maxScreeningIntervalMin, 90);
});

await t("llm.generalMaxTokens 8192", () => {
  assert.strictEqual(config.llm.generalMaxTokens, 8192);
});

await t("learning.evolveEnabled true (blok baru)", () => {
  assert.ok(config.learning);
  assert.strictEqual(config.learning.evolveEnabled, true);
});

await t("jupiter.referralEnabled true", () => {
  assert.strictEqual(config.jupiter.referralEnabled, true);
});

await t("indicators exitEnabled/rejectAlreadyAtBottom/smi*", () => {
  const ic = config.indicators;
  assert.strictEqual(ic.exitEnabled, false);
  assert.strictEqual(ic.rejectAlreadyAtBottom, false);
  assert.strictEqual(ic.smiPdLookback, 5);
  assert.strictEqual(ic.smiPaLookback, 3);
  assert.strictEqual(ic.smiCrossWindow, 3);
});

await t("experiments: 16 flag default fork", () => {
  const e = config.experiments;
  assert.ok(e, "blok experiments ada");
  assert.strictEqual(e.exitLiquidityCheck, false);
  assert.strictEqual(e.exitLiquidityMaxSlippagePct, 10);
  assert.strictEqual(e.marketRegimeGate, false);
  assert.strictEqual(e.marketRegimeMaxDrop24hPct, 8);
  assert.strictEqual(e.candidateMomentum, false);
  assert.strictEqual(e.narrativeProfileSignal, false);
  assert.strictEqual(e.expectedYieldSignal, false);
  assert.strictEqual(e.convictionSizing, false);
  assert.strictEqual(e.convictionSizingMaxAdjustPct, 30);
  assert.strictEqual(e.counterfactualReview, false);
  assert.strictEqual(e.counterfactualMinMcapGainPct, 25);
  assert.strictEqual(e.smartWalletMomentum, false);
  assert.strictEqual(e.idleScreeningCooldown, false);
  assert.strictEqual(e.idleScreeningCooldownMin, 20);
  assert.strictEqual(e.paperTrading, false);
  assert.strictEqual(e.usePaperHistoryWhenLive, false);
});

await t("reports learningReportEvery/TrendN 10/10", () => {
  assert.strictEqual(config.reports.learningReportEvery, 10);
  assert.strictEqual(config.reports.learningReportTrendN, 10);
});

// Deviasi-sadar: opportunity poller vanilla NYALA (fork tak punya) — keputusan owner.
await t("DEVIASI: config.opportunity.enabled === true (poller nyala)", () => {
  assert.strictEqual(config.opportunity.enabled, true);
});

// Reload via hook config:reload (patch 08) — ubah user-config → key custom terupdate.
await t("reload: sizingMode/categories/promptNotes/evolveEnabled terupdate via hook", () => {
  writeFileSync(ucPath, JSON.stringify({
    sizingMode: "maximize",
    screeningCategories: ["trending", "new"],
    promptNotes: ["be aggressive"],
    evolveEnabled: false,
    rentPerPositionSol: 0.057,
  }));
  reloadScreeningThresholds();
  assert.strictEqual(config.management.sizingMode, "maximize");
  assert.deepStrictEqual(config.screening.categories, ["trending", "new"]);
  assert.deepStrictEqual(config.promptNotes, { screener: ["be aggressive"], manager: [], general: [] });
  assert.strictEqual(config.learning.evolveEnabled, false);
  assert.strictEqual(config.management.rentPerPositionSol, 0.057);
});

// Patch 09: user-config dryRun MENANG atas env DRY_RUN (subprocess — env+singleton).
await t("patch 09: dryRun:false di user-config menang atas env DRY_RUN=true", () => {
  writeFileSync(ucPath, JSON.stringify({ dryRun: false }));
  const script = `import { config } from ${JSON.stringify(pathToFileURL(join(target, "config.js")).href)}; process.stdout.write(String(process.env.DRY_RUN));`;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, DRY_RUN: "true" }, cwd: target,
  }).toString().trim();
  assert.strictEqual(out, "false", `DRY_RUN=${out} (user-config harus menang)`);
});

restore();
console.log(`\nconfig-ext: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
