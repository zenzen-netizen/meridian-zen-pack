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
// PRA-8: Stage 7 made tools/gmgn.js fork-complete, exposing a latent boot gap:
// vanilla config.js still loads only five GMGN fields. This plugin now owns the
// complete fork GMGN load/reload path plus profile-aware legacy migration.
// DEFER 5.2: fungsi sizing export fork (minDeployAmount/computeDeployAmount mode
//   maximize/applyConvictionSizing/persistConfigChange) — konsumen belum diport.
import fs from "node:fs";
import { config } from "../config.js";
import { paths } from "../paths.js";
import { migrateLegacyGmgnConfig } from "../zenpack-lib/config-migration.js";

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

function readGmgnConfig() {
  try {
    if (!fs.existsSync(paths.gmgnConfigPath)) return {};
    return JSON.parse(fs.readFileSync(paths.gmgnConfigPath, "utf8"));
  } catch (e) {
    throw new Error(`gmgn-config.json tidak valid: ${e.message}`);
  }
}

function nonEmptyString(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function injectGmgnKeys(u, gmgnUserConfig) {
  const gmgnValue = (key, legacyKey, fallback) => gmgnUserConfig[key] ?? u[legacyKey] ?? fallback;
  const gmgnArray = (key, legacyKey, fallback) => {
    if (Array.isArray(gmgnUserConfig[key])) return gmgnUserConfig[key];
    if (Array.isArray(u[legacyKey])) return u[legacyKey];
    return fallback;
  };

  // Verbatim fork config.js:159-214, adapted only to plugin-owned inputs.
  config.gmgn = {
    apiKey: nonEmptyString(gmgnUserConfig.apiKey, u.gmgnApiKey, process.env.GMGN_API_KEY),
    baseUrl: nonEmptyString(gmgnUserConfig.baseUrl, u.gmgnBaseUrl, "https://openapi.gmgn.ai"),
    feeSource: nonEmptyString(gmgnUserConfig.feeSource, u.gmgnFeeSource, "gmgn"),
    interval: gmgnValue("interval", "gmgnInterval", "5m"),
    orderBy: gmgnValue("orderBy", "gmgnOrderBy", "default"),
    direction: gmgnValue("direction", "gmgnDirection", "desc"),
    limit: gmgnValue("limit", "gmgnLimit", 100),
    enrichLimit: gmgnValue("enrichLimit", "gmgnEnrichLimit", 20),
    requestDelayMs: gmgnValue("requestDelayMs", "gmgnRequestDelayMs", 350),
    maxRetries: gmgnValue("maxRetries", "gmgnMaxRetries", 2),
    holdersLimit: gmgnValue("holdersLimit", "gmgnHoldersLimit", 100),
    klineResolution: gmgnValue("klineResolution", "gmgnKlineResolution", "5m"),
    klineLookbackMinutes: gmgnValue("klineLookbackMinutes", "gmgnKlineLookbackMinutes", 60),
    filters: gmgnArray("filters", "gmgnFilters", ["renounced", "frozen", "not_wash_trading"]),
    platforms: gmgnArray("platforms", "gmgnPlatforms", ["Pump.fun", "meteora_virtual_curve", "pool_meteora"]),
    minMcap: gmgnValue("minMcap", "gmgnMinMcap", u.minMcap ?? 150_000),
    maxMcap: gmgnValue("maxMcap", "gmgnMaxMcap", u.maxMcap ?? 10_000_000),
    minTvl: gmgnValue("minTvl", "gmgnMinTvl", u.minTvl ?? 10_000),
    minVolume: gmgnValue("minVolume", "gmgnMinVolume", 1000),
    minHolders: gmgnValue("minHolders", "gmgnMinHolders", u.minHolders ?? 500),
    minTokenAgeHours: gmgnValue("minTokenAgeHours", "gmgnMinTokenAgeHours", 2),
    maxTokenAgeHours: gmgnValue("maxTokenAgeHours", "gmgnMaxTokenAgeHours", 24 * 7),
    minSmartDegenCount: gmgnValue("minSmartDegenCount", "gmgnMinSmartDegenCount", 1),
    requireKol: gmgnValue("requireKol", "gmgnRequireKol", true),
    minKolCount: gmgnValue("minKolCount", "gmgnMinKolCount", 1),
    maxRugRatio: gmgnValue("maxRugRatio", "gmgnMaxRugRatio", 0.3),
    maxTop10HolderRate: gmgnValue("maxTop10HolderRate", "gmgnMaxTop10HolderRate", 0.5),
    maxBundlerRate: gmgnValue("maxBundlerRate", "gmgnMaxBundlerRate", 0.5),
    maxRatTraderRate: gmgnValue("maxRatTraderRate", "gmgnMaxRatTraderRate", 0.2),
    maxFreshWalletRate: gmgnValue("maxFreshWalletRate", "gmgnMaxFreshWalletRate", 0.2),
    maxDevTeamHoldRate: gmgnValue("maxDevTeamHoldRate", "gmgnMaxDevTeamHoldRate", 0.02),
    preferredKolMinHoldPct: gmgnValue("preferredKolMinHoldPct", "gmgnPreferredKolMinHoldPct", 1),
    dumpKolMinHoldPct: gmgnValue("dumpKolMinHoldPct", "gmgnDumpKolMinHoldPct", 0.5),
    maxBotDegenRate: gmgnValue("maxBotDegenRate", "gmgnMaxBotDegenRate", 0.4),
    maxSniperCount: gmgnValue("maxSniperCount", "gmgnMaxSniperCount", 20),
    maxSniperHoldRate: gmgnValue("maxSniperHoldRate", "gmgnMaxSniperHoldRate", 0.3),
    minTotalFeeSol: gmgnValue("minTotalFeeSol", "gmgnMinTotalFeeSol", 30),
    athFilterPct: gmgnValue("athFilterPct", "gmgnAthFilterPct", null),
    preferredKolNames: gmgnArray("preferredKolNames", "gmgnPreferredKolNames", []),
    dumpKolNames: gmgnArray("dumpKolNames", "gmgnDumpKolNames", []),
    indicatorFilter: gmgnValue("indicatorFilter", "gmgnIndicatorFilter", true),
    indicatorInterval: gmgnValue("indicatorInterval", "gmgnIndicatorInterval", "15_MINUTE"),
    indicatorRules: (() => {
      const r = gmgnUserConfig.indicatorRules || {};
      return {
        requireBullishSupertrend: r.requireBullishSupertrend ?? true,
        rejectAlreadyAtBottom: r.rejectAlreadyAtBottom ?? true,
        requireAboveSupertrend: r.requireAboveSupertrend ?? false,
        minRsi: r.minRsi ?? null,
        maxRsi: r.maxRsi ?? null,
        requireBbPosition: r.requireBbPosition ?? null,
      };
    })(),
  };
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

  // ─── Dual-side (E1) — default OFF, byte-identical saat OFF ───
  // Naruh sebagian kecil modal sbg TOKEN di bin ATAS harga → nangkep fee & apresiasi
  // saat harga pump. OFF = single-side SOL seperti biasa (nol perubahan perilaku).
  st.dualSideEnabled   = u.dualSideEnabled   ?? false;  // gerbang utama
  st.dualSideTokenPct  = u.dualSideTokenPct  ?? 10;     // PERSEN (10 = 10%); di-/100 saat dipakai
  st.dualSideUpsidePct = u.dualSideUpsidePct ?? 15;     // seberapa jauh (%) di atas harga token dipasang
  st.dualSideStrategy  = u.dualSideStrategy  ?? "bid_ask"; // "spot" | "bid_ask" bentuk sebaran atas

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
  injectGmgnKeys(fresh, readGmgnConfig());
}

export const manifest = { name: "zenpack-config-ext", priority: 50 };

export function register(hooks) {
  const migration = migrateLegacyGmgnConfig({
    userConfigPath: paths.userConfigPath,
    gmgnConfigPath: paths.gmgnConfigPath,
  });
  if (migration.migrated.length) {
    console.log(`[zen-pack:50] migrasi GMGN: ${migration.migrated.join(", ")}`);
  }
  if (migration.preservedUnknown.length) {
    console.warn(`[zen-pack:50] legacy GMGN tidak dikenal dipertahankan: ${migration.preservedUnknown.join(", ")}`);
  }
  const u = readUserConfig();
  injectCustomKeys(u);
  injectGmgnKeys(u, readGmgnConfig());
  hooks.on("config:reload", onConfigReload);
}
