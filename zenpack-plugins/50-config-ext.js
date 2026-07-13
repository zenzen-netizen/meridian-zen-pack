// Plugin 50: suntik key custom fork ke objek `config` vanilla (config.js bag 1).
// DESAIN (terkunci owner): mutasi LANGSUNG objek `config` yg di-export config.js
// saat register() — referensi sama di semua modul (config di-import sekali, live).
// BUKAN hook build-time (loader bisa jalan sesudah config di-import konsumen; tapi
// SEMUA konsumen key custom baca call-time dgn `?.`+`??` → aman, lihat FASE A.2).
//
// SUMBER NILAI DEFAULT: port VERBATIM fork-ref config.js (nilai fork dikutip di
// komentar per blok). Vanilla config.js tak meng-export `u` (user-config mentah),
// jadi plugin baca ULANG user-config.json sendiri via paths.userConfigPath (patch
// 02 routing) — satu sumber konsisten.
//
// FAIL-LOUD (gaya plugin 40): user-config gagal dibaca → console.warn + degrade
// (u = {} → key custom pakai default fork), JANGAN crash boot.
//
// DI LUAR SCOPE (FASE A.3, vonis no-op di vanilla — NOL konsumen):
//   - screening.source (screeningSource) — tak dibaca vanilla mana pun.
//   - gmgn SUPERSET ~40 key fork — vanilla tools/gmgn.js cuma baca 5 key gmgn yg
//     vanilla config.js sudah punya. Tak ditambah (orphan, sama seperti brief
//     item-2: maxBundlePct/athFilterPct).
// DEFER 5.2: fungsi sizing export fork (minDeployAmount/computeDeployAmount mode
//   maximize/applyConvictionSizing/persistConfigChange) — konsumen belum diport.
import fs from "node:fs";
import { config } from "../config.js";
import { paths } from "../paths.js";

// Port VERBATIM fork-ref config.js:77-86.
function normalizePromptNotes(raw) {
  const clean = (v) => Array.isArray(v)
    ? v.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
    : [];
  if (Array.isArray(raw)) return { screener: clean(raw), manager: [], general: [] };
  if (raw && typeof raw === "object") {
    return { screener: clean(raw.screener), manager: clean(raw.manager), general: clean(raw.general) };
  }
  return { screener: [], manager: [], general: [] };
}

function numericConfig(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readUserConfig() {
  try {
    if (!fs.existsSync(paths.userConfigPath)) return {};
    return JSON.parse(fs.readFileSync(paths.userConfigPath, "utf8"));
  } catch (e) {
    console.warn(`[zen-pack:50] user-config unreadable, key custom pakai default: ${e.message}`);
    return {};
  }
}

// Suntik semua key custom (default fork) ke config. Idempotent (re-assign nilai sama).
function injectCustomKeys(u) {
  // ── Identity / Setup (fork config.js:115-118) ──
  config.profile     = u.preset      ?? "moderate";
  config.activeSetup = u.activeSetup ?? null;
  config.promptNotes = normalizePromptNotes(u.promptNotes);

  // ── screening.categories (fork :145) ── source(:128) = orphan, di-skip.
  config.screening.categories = Array.isArray(u.screeningCategories) ? u.screeningCategories : null;

  // ── management (fork :240-253) ──
  const m = config.management;
  m.gasReserveAutoTune   = u.gasReserveAutoTune   ?? false;
  m.gasReserveBufferDays = u.gasReserveBufferDays ?? 14;
  m.gasReserveFloorSol   = u.gasReserveFloorSol   ?? 0.03;
  m.sizingMode           = u.sizingMode           ?? "fixed";
  m.rentPerPositionSol   = u.rentPerPositionSol   ?? 0;

  // ── strategy (fork :269, :277-280) ──
  const st = config.strategy;
  st.strategyLock      = u.strategyLock      ?? "default";
  st.dualSideEnabled   = u.dualSideEnabled   ?? false;
  st.dualSideTokenPct  = u.dualSideTokenPct  ?? 10;
  st.dualSideUpsidePct = u.dualSideUpsidePct ?? 15;
  st.dualSideStrategy  = u.dualSideStrategy  ?? "bid_ask";

  // ── schedule (fork :292-293) ──
  config.schedule.adaptiveScreening       = u.adaptiveScreening       ?? false;
  config.schedule.maxScreeningIntervalMin = u.maxScreeningIntervalMin ?? 90;

  // ── llm (fork :300) ──
  config.llm.generalMaxTokens = u.generalMaxTokens ?? 8192;

  // ── learning (blok baru, fork :312-314) ──
  config.learning = { evolveEnabled: u.evolveEnabled ?? true };

  // ── jupiter (fork :365) ──
  config.jupiter.referralEnabled = u.jupiterReferralEnabled ?? true;

  // ── indicators (fork :375, :388, :394-396) — baca dari u.chartIndicators ──
  const ind = u.chartIndicators ?? {};
  const ic = config.indicators;
  ic.exitEnabled          = ind.exitEnabled          ?? false;
  ic.rejectAlreadyAtBottom = ind.rejectAlreadyAtBottom ?? false;
  ic.smiPdLookback        = ind.smiPdLookback        ?? 5;
  ic.smiPaLookback        = ind.smiPaLookback        ?? 3;
  ic.smiCrossWindow       = ind.smiCrossWindow       ?? 3;

  // ── experiments (blok baru penuh, fork :404-479) ──
  config.experiments = {
    exitLiquidityCheck:           u.exitLiquidityCheck           ?? false,
    exitLiquidityMaxSlippagePct:  u.exitLiquidityMaxSlippagePct  ?? 10,
    marketRegimeGate:             u.marketRegimeGate             ?? false,
    marketRegimeMaxDrop24hPct:    u.marketRegimeMaxDrop24hPct    ?? 8,
    candidateMomentum:            u.candidateMomentum            ?? false,
    narrativeProfileSignal:       u.narrativeProfileSignal       ?? false,
    expectedYieldSignal:          u.expectedYieldSignal          ?? false,
    convictionSizing:             u.convictionSizing             ?? false,
    convictionSizingMaxAdjustPct: u.convictionSizingMaxAdjustPct ?? 30,
    counterfactualReview:         u.counterfactualReview         ?? false,
    counterfactualMinMcapGainPct: u.counterfactualMinMcapGainPct ?? 25,
    smartWalletMomentum:          u.smartWalletMomentum          ?? false,
    idleScreeningCooldown:        u.idleScreeningCooldown        ?? false,
    idleScreeningCooldownMin:     u.idleScreeningCooldownMin     ?? 20,
    paperTrading:                 u.paperTrading                 ?? false,
    usePaperHistoryWhenLive:      u.usePaperHistoryWhenLive      ?? false,
  };

  // ── reports (blok baru, fork :485-487) ──
  config.reports = {
    learningReportEvery:  u.learningReportEvery  ?? 10,
    learningReportTrendN: u.learningReportTrendN ?? 10,
  };
}

// Handler config:reload (patch 08) — re-apply key custom yg fork reload sentuh
// (fork config.js:638-647). Sumber data = `fresh` dari ctx hook.
function onConfigReload(ctx) {
  const fresh = ctx?.fresh;
  if (!fresh || typeof fresh !== "object") return;
  if (fresh.screeningCategories !== undefined) {
    config.screening.categories = Array.isArray(fresh.screeningCategories) ? fresh.screeningCategories : null;
  }
  if (fresh.promptNotes !== undefined) config.promptNotes = normalizePromptNotes(fresh.promptNotes);
  if (fresh.activeSetup !== undefined) config.activeSetup = fresh.activeSetup;
  if (fresh.evolveEnabled !== undefined) {
    if (!config.learning) config.learning = {};
    config.learning.evolveEnabled = fresh.evolveEnabled;
  }
  if (fresh.sizingMode !== undefined) config.management.sizingMode = fresh.sizingMode;
  if (fresh.rentPerPositionSol !== undefined) {
    const rv = numericConfig(fresh.rentPerPositionSol);
    if (rv != null) config.management.rentPerPositionSol = rv;
  }
}

export const manifest = { name: "zenpack-config-ext", priority: 50 };

export function register(hooks) {
  injectCustomKeys(readUserConfig());
  hooks.on("config:reload", onConfigReload);
}
