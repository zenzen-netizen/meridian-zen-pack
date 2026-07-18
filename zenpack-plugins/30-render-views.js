// Render views: /status /positions (batch 1, Stage 3.6) + /wallet /config /pool
// (batch 2, Stage 3.7) via views/ layer. Blok data-fetch = VERBATIM fork-ref
// index.js, diadaptasi jadi handler hook "telegram:command":
//   (a) view HTML dikirim lewat sendHTML (export vanilla telegram.js:164); /config
//       plain-text dikirim lewat sendMessage per-chunk (splitText @4096 — vanilla
//       sendMessage MEN-TRUNCATE, tak split, jadi splitText di-port biar detail utuh).
//   (b) ctx.handled = true supaya patch 03b return sebelum handler vanilla; saat
//       pack di-uninstall handler vanilla hidup lagi (dead-path terbalik).
//       Dead-path vanilla: /status+/wallet (index.js:1451 `/wallet || /status`),
//       /config bare (1464 formatConfigSnapshot), /pool <n> (1486). CATATAN:
//       vanilla TAK punya "/config core" & "/config origin" → dua sub-cmd itu
//       PLUGIN-ADDITIVE (uninstall → jadi unknown lagi, jatuh ke LLM).
//   (c) Stage 7.3 melunasi DEFER Stage 3.7: held/rent, solPrice, OpenRouter,
//       condensed Insight, disclosure, dan /pool rangeEff kini hidup via dep yang
//       sudah tersedia pasca patch/drop-in; fetch optional fail-open.
//   (d) Patch 23: pnlBlock hidup setelah reports.js + lessons read-layer tersedia.
import { getMyPositions, getPositionsRentSol } from "../tools/dlmm.js";
import { getWalletBalances, getSolMarketRegime } from "../tools/wallet.js";
import { config, computeDeployAmount } from "../config.js";
import { getPerformanceSummary, getModePerformance, getExcludedRacikanStats, listLessons } from "../lessons.js";
import { formatSolTracker } from "../sol-tracker.js";
import { formatPnlTracker } from "../pnl-tracker.js";
import { formatIdentity, getActiveSetupStatus } from "../preset-manager.js";
import { getOpenRouterBalance, getOpenRouterCredits } from "../openrouter-usage.js";
import { CORE_GROUPS } from "../config-origin.js";
import { isHiveMindEnabled } from "../hivemind.js";
import { getTrackedPosition } from "../state.js";
import { sendHTML, sendMessage } from "../telegram.js";
import { render } from "../views/render.js";
import * as statusView from "../views/status.js";
import * as positionsView from "../views/positions.js";
import * as walletView from "../views/wallet.js";
import * as configView from "../views/config.js";
import * as poolView from "../views/pool.js";
import * as systemView from "../views/system.js";
import { ICON } from "../views/format.js";

export const manifest = { name: "zenpack-render-views", priority: 100 };

// ── Helpers port VERBATIM fork index.js (render-only, pure atas `config`) ─────────
// splitText: fork telegram.js:151 (vanilla sendMessage truncate → butuh split lokal).
function splitText(text, limit = 4096) {
  const str = String(text);
  if (str.length <= limit) return [str];
  const chunks = [];
  let remaining = str;
  while (remaining.length > 0) {
    if (remaining.length <= limit) { chunks.push(remaining); break; }
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit * 0.3) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n/, "");
  }
  return chunks;
}

async function sendPlain(text) {
  for (const chunk of splitText(text)) await sendMessage(chunk);
}

// utang 3.7 LUNAS di 7.3 — helper display index-local fork, render-only.
// Compact age label from minutes: <60 → "Xm", else "Y.yh".
function fmtAgeMin(m) {
  if (m == null || !Number.isFinite(m)) return "?";
  return m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`;
}

/**
 * RENDER-ONLY range-efficiency lines for /pool, derived from live position data
 * (lower/upper/active bin, in_range, age, current OOR spell) + the tracked record
 * (bin_step). Shows the bin range + width, where active sits within it (a bar +
 * distance to each edge), the live in/OOR state, and a live in-range estimate.
 * NOTE: minutes_out_of_range is the CURRENT OOR spell only (state resets it on
 * re-entry), so the live in-range % is labelled an approximation (see
 * notes/routput-progress.md RECON range-tracking).
 */
function buildRangeEfficiencyLines(pos, tracked) {
  const out = [];
  const lo = pos.lower_bin, hi = pos.upper_bin, act = pos.active_bin;
  const binStep = tracked?.bin_step ?? null;
  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    const width = hi - lo + 1;
    const stepStr = binStep != null ? ` · bin_step ${binStep}` : "";
    out.push(`Range bins: ${lo} → ${hi} (${width} bins${stepStr})`);
    if (Number.isFinite(act)) {
      // Position of active bin within the range (0% = lower edge, 100% = upper).
      const span = hi - lo;
      const posPct = span > 0 ? Math.max(0, Math.min(100, ((act - lo) / span) * 100)) : (act >= hi ? 100 : 0);
      const filled = Math.round((posPct / 100) * 20);
      const bar = "█".repeat(Math.max(0, Math.min(20, filled))) + "░".repeat(Math.max(0, 20 - filled));
      out.push(`Active bin ${act}: [${bar}] ${posPct.toFixed(0)}% (${act - lo} dari bawah / ${hi - act} ke atas)`);
    }
  } else {
    out.push(`Range bins: ${lo ?? "?"} → ${hi ?? "?"} | active ${act ?? "?"}`);
  }
  // Live state (exact) + a live in-range estimate from age & current OOR spell.
  const state = pos.in_range ? "✅ IN RANGE" : `⚠️ OOR ${pos.minutes_out_of_range ?? 0}m`;
  out.push(`State: ${state}`);
  const age = pos.age_minutes, oor = pos.minutes_out_of_range ?? 0;
  if (Number.isFinite(age) && age > 0) {
    const inRangePct = Math.max(0, Math.min(100, ((age - oor) / age) * 100));
    out.push(`In-range (approx): ~${inRangePct.toFixed(0)}% · in ~${fmtAgeMin(Math.max(0, age - oor))} / OOR-spell ${fmtAgeMin(oor)}`);
  }
  return out;
}

// OpenRouter balance/usage → array baris (logika verbatim dari /status+/wallet lama).
// Array (bukan string) supaya tree() di views/ bisa kasih prefix per baris (incl
// baris ⚠️ "menipis"). USD by-design — tetap `$`. Kosong → [].
function buildOpenRouterLines(orBalance, orCredits) {
  const lines = [];
  if (orCredits?.balance != null) {
    // Actual purchased-credit balance — the number to watch for top-ups.
    let l = `💳 OpenRouter saldo: $${orCredits.balance.toFixed(2)}`;
    if (orBalance?.usageDaily != null) l += ` | hari ini $${orBalance.usageDaily.toFixed(4)}`;
    else if (orBalance?.usageMonthly != null) l += ` | bln ini $${orBalance.usageMonthly.toFixed(2)}`;
    lines.push(l);
    if (orCredits.balance < 5) lines.push(`⚠️ Saldo OpenRouter menipis — pertimbangkan top up`);
  } else if (orBalance) {
    if (orBalance.remaining != null) {
      let l = `💳 OpenRouter: $${orBalance.remaining.toFixed(2)} remaining`;
      if (orBalance.usageMonthly != null) l += ` | $${orBalance.usageMonthly.toFixed(2)} this month`;
      else if (orBalance.usage != null) l += ` | $${orBalance.usage.toFixed(4)} total spent`;
      lines.push(l);
    } else if (orBalance.usageDaily != null) {
      lines.push(`💳 OpenRouter: $${orBalance.usageDaily.toFixed(4)} today | $${(orBalance.usageMonthly ?? 0).toFixed(2)} this month`);
    } else if (orBalance.usage != null) {
      lines.push(`💳 OpenRouter: $${orBalance.usage.toFixed(4)} total spent`);
    }
  }
  return lines;
}

// Condense a learning rule into a short, COMPLETE one-liner for /status.
// Keeps the subject + headline metric, drops the verbose advisory tail, and
// never cuts mid-word (the old raw slice(0,120) chopped at "PnL +").
function condenseRule(rule) {
  let s = String(rule || "").replace(/\s+/g, " ").trim();
  if (!s) return s;
  // Round noisy volatility floats: volatility=2.4598 → vol=2.5
  s = s.replace(/volatility=(\d+\.\d+)/g, (_, n) => `vol=${(+n).toFixed(1)}`);
  // Split "<subject> — <explanation>" (or "→") and keep only the first
  // sentence of the explanation, dropping advisory boilerplate.
  const m = s.match(/^(.*?)\s([—→])\s(.*)$/);
  if (m) {
    const tail = m[3].split(/\.\s/)[0].replace(/\.$/, "").trim();
    s = `${m[1].trim()} ${m[2]} ${tail}`;
  } else {
    s = s.split(/\.\s/)[0].replace(/\.$/, "").trim();
  }
  // Safety net: hard cap on a word boundary with an ellipsis.
  if (s.length > 140) s = s.slice(0, 140).replace(/\s+\S*$/, "") + "…";
  return s;
}

export function racikanScopeDisclosure() {
  try {
    const { count, net_usd } = getExcludedRacikanStats();
    if (!count) return "";
    const s = `${net_usd >= 0 ? "+" : "-"}$${Math.abs(net_usd).toFixed(2)}`;
    return `\n\n⚠️ ${count} trade live di luar racikan ini dikecualikan (PnL ${s}) — /report all buat semua.`;
  } catch { return ""; }
}

// buildConfigRowMap: fork index.js:1733 VERBATIM. Pure atas config + isHiveMindEnabled.
export function buildConfigRowMap() {
  const c = config;
  const fmt = (v) => {
    if (v === null || v === undefined) return "off";
    if (typeof v === "boolean") return v ? "🟢 on" : "⚪ off";
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    return String(v);
  };
  const secret = (v) => (v && String(v).length ? "(set)" : "(unset)");
  const ir = c.gmgn.indicatorRules || {};

  // rowMap: unique key → [displayLabel, valueString]. GMGN screening rows are
  // namespaced "gmgn." so they don't collide with their screening twins; their
  // visible label stays the short form (interval, minTvl, …) as before.
  const rowMap = {
    // ── Screening (dev) ──
    timeframe: ["timeframe", fmt(c.screening.timeframe)],
    category: ["category", fmt(c.screening.category)],
    minTvl: ["minTvl", fmt(c.screening.minTvl)],
    maxTvl: ["maxTvl", fmt(c.screening.maxTvl)],
    minVolume: ["minVolume", fmt(c.screening.minVolume)],
    minFeeActiveTvlRatio: ["minFeeActiveTvlRatio", fmt(c.screening.minFeeActiveTvlRatio)],
    minTokenFeesSol: ["minTokenFeesSol", fmt(c.screening.minTokenFeesSol)],
    minOrganic: ["minOrganic", fmt(c.screening.minOrganic)],
    minQuoteOrganic: ["minQuoteOrganic", fmt(c.screening.minQuoteOrganic)],
    minMcap: ["minMcap", fmt(c.screening.minMcap)],
    maxMcap: ["maxMcap", fmt(c.screening.maxMcap)],
    minHolders: ["minHolders", fmt(c.screening.minHolders)],
    minTokenAgeHours: ["minTokenAgeHours", fmt(c.screening.minTokenAgeHours)],
    maxTokenAgeHours: ["maxTokenAgeHours", fmt(c.screening.maxTokenAgeHours)],
    minBinStep: ["minBinStep", fmt(c.screening.minBinStep)],
    maxBinStep: ["maxBinStep", fmt(c.screening.maxBinStep)],
    excludeHighSupplyConcentration: ["excludeHighSupplyConcentration", fmt(c.screening.excludeHighSupplyConcentration)],
    maxBotHoldersPct: ["maxBotHoldersPct", fmt(c.screening.maxBotHoldersPct)],
    maxTop10Pct: ["maxTop10Pct", fmt(c.screening.maxTop10Pct)],
    avoidPvpSymbols: ["avoidPvpSymbols", fmt(c.screening.avoidPvpSymbols)],
    blockPvpSymbols: ["blockPvpSymbols", fmt(c.screening.blockPvpSymbols)],
    allowedLaunchpads: ["allowedLaunchpads", fmt(c.screening.allowedLaunchpads)],
    blockedLaunchpads: ["blockedLaunchpads", fmt(c.screening.blockedLaunchpads)],
    useDiscordSignals: ["useDiscordSignals", fmt(c.screening.useDiscordSignals)],
    discordSignalMode: ["discordSignalMode", fmt(c.screening.discordSignalMode)],

    // ── Management & Risk (dev) ──
    dryRun: ["dryRun", fmt(String(process.env.DRY_RUN || "").toLowerCase() === "true")],
    maxPositions: ["maxPositions", fmt(c.risk.maxPositions)],
    maxDeployAmount: ["maxDeployAmount", fmt(c.risk.maxDeployAmount)],
    deployAmountSol: ["deployAmountSol", fmt(c.management.deployAmountSol)],
    positionSizePct: ["positionSizePct", fmt(c.management.positionSizePct)],
    minSolToOpen: ["minSolToOpen", fmt(c.management.minSolToOpen)],
    gasReserve: ["gasReserve", `${fmt(c.management.gasReserve)}${c.management.gasReserveAutoTune ? " (auto-tune ON)" : " (manual)"}`],
    stopLossPct: ["stopLossPct", fmt(c.management.stopLossPct)],
    takeProfitPct: ["takeProfitPct", fmt(c.management.takeProfitPct)],
    trailingTakeProfit: ["trailingTakeProfit", fmt(c.management.trailingTakeProfit)],
    trailingTriggerPct: ["trailingTriggerPct", fmt(c.management.trailingTriggerPct)],
    trailingDropPct: ["trailingDropPct", fmt(c.management.trailingDropPct)],
    outOfRangeBinsToClose: ["outOfRangeBinsToClose", fmt(c.management.outOfRangeBinsToClose)],
    outOfRangeWaitMinutes: ["outOfRangeWaitMinutes", fmt(c.management.outOfRangeWaitMinutes)],
    oorCooldownTriggerCount: ["oorCooldownTriggerCount", fmt(c.management.oorCooldownTriggerCount)],
    oorCooldownHours: ["oorCooldownHours", fmt(c.management.oorCooldownHours)],
    minFeePerTvl24h: ["minFeePerTvl24h", fmt(c.management.minFeePerTvl24h)],
    minAgeBeforeYieldCheck: ["minAgeBeforeYieldCheck", fmt(c.management.minAgeBeforeYieldCheck)],
    minVolumeToRebalance: ["minVolumeToRebalance", fmt(c.management.minVolumeToRebalance)],
    minClaimAmount: ["minClaimAmount", fmt(c.management.minClaimAmount)],
    autoSwapAfterClaim: ["autoSwapAfterClaim", fmt(c.management.autoSwapAfterClaim)],
    repeatDeployCooldownEnabled: ["repeatDeployCooldownEnabled", fmt(c.management.repeatDeployCooldownEnabled)],
    repeatDeployCooldownTriggerCount: ["repeatDeployCooldownTriggerCount", fmt(c.management.repeatDeployCooldownTriggerCount)],
    repeatDeployCooldownHours: ["repeatDeployCooldownHours", fmt(c.management.repeatDeployCooldownHours)],
    repeatDeployCooldownScope: ["repeatDeployCooldownScope", fmt(c.management.repeatDeployCooldownScope)],
    repeatDeployCooldownMinFeeEarnedPct: ["repeatDeployCooldownMinFeeEarnedPct", fmt(c.management.repeatDeployCooldownMinFeeEarnedPct)],
    solMode: ["solMode", fmt(c.management.solMode)],

    // ── Strategy & Bins (dev) ──
    strategy: ["strategy", fmt(c.strategy.strategy)],
    minBinsBelow: ["minBinsBelow", fmt(c.strategy.minBinsBelow)],
    maxBinsBelow: ["maxBinsBelow", fmt(c.strategy.maxBinsBelow)],
    defaultBinsBelow: ["defaultBinsBelow", fmt(c.strategy.defaultBinsBelow)],

    // ── Schedule (dev) ──
    managementIntervalMin: ["managementIntervalMin", fmt(c.schedule.managementIntervalMin)],
    screeningIntervalMin: ["screeningIntervalMin", fmt(c.schedule.screeningIntervalMin)],
    healthCheckIntervalMin: ["healthCheckIntervalMin", fmt(c.schedule.healthCheckIntervalMin)],

    // ── LLM (dev) ──
    managementModel: ["managementModel", fmt(c.llm.managementModel)],
    screeningModel: ["screeningModel", fmt(c.llm.screeningModel)],
    generalModel: ["generalModel", fmt(c.llm.generalModel)],
    temperature: ["temperature", fmt(c.llm.temperature)],
    maxTokens: ["maxTokens", fmt(c.llm.maxTokens)],
    maxSteps: ["maxSteps", fmt(c.llm.maxSteps)],

    // ── Darwin (dev) ──
    darwinEnabled: ["darwinEnabled", fmt(c.darwin.enabled)],
    darwinWindowDays: ["darwinWindowDays", fmt(c.darwin.windowDays)],
    darwinRecalcEvery: ["darwinRecalcEvery", fmt(c.darwin.recalcEvery)],
    darwinBoost: ["darwinBoost", fmt(c.darwin.boostFactor)],
    darwinDecay: ["darwinDecay", fmt(c.darwin.decayFactor)],
    darwinFloor: ["darwinFloor", fmt(c.darwin.weightFloor)],
    darwinCeiling: ["darwinCeiling", fmt(c.darwin.weightCeiling)],
    darwinMinSamples: ["darwinMinSamples", fmt(c.darwin.minSamples)],

    // ── Indicators (dev) ──
    enabled: ["enabled", fmt(c.indicators.enabled)],
    entryPreset: ["entryPreset", fmt(c.indicators.entryPreset)],
    exitPreset: ["exitPreset", `${fmt(c.indicators.exitPreset)}${c.indicators.exitEnabled ? "" : " (gerbang exit ⚪ off — preset ini belum aktif)"}`],
    rsiLength: ["rsiLength", fmt(c.indicators.rsiLength)],
    intervals: ["intervals", fmt(c.indicators.intervals)],
    candles: ["candles", fmt(c.indicators.candles)],
    rsiOversold: ["rsiOversold", fmt(c.indicators.rsiOversold)],
    rsiOverbought: ["rsiOverbought", fmt(c.indicators.rsiOverbought)],
    requireAllIntervals: ["requireAllIntervals", fmt(c.indicators.requireAllIntervals)],

    // ── Infra/Meridian (dev) ──
    lpAgentRelayEnabled: ["lpAgentRelayEnabled", fmt(c.api.lpAgentRelayEnabled)],
    agentId: ["agentId", fmt(c.hiveMind.agentId)],
    publicApiKey: ["publicApiKey", secret(c.api.publicApiKey)],
    pnlSource: ["pnlSource", fmt(c.pnl.source)],
    pnlRpcUrl: ["pnlRpcUrl", fmt(c.pnl.rpcUrl)],
    pnlPollIntervalSec: ["pnlPollIntervalSec", fmt(c.pnl.pollIntervalSec)],
    pnlDepositCacheTtlSec: ["pnlDepositCacheTtlSec", fmt(c.pnl.depositCacheTtlSec)],
    pnlSanityMaxDiffPct: ["pnlSanityMaxDiffPct", fmt(c.management.pnlSanityMaxDiffPct)],
    gmgnFeeSource: ["gmgnFeeSource", fmt(c.gmgn.feeSource)],
    hiveMindStatus: ["status", isHiveMindEnabled() ? "enabled" : "disabled"],
    hiveMindPullMode: ["hiveMindPullMode", fmt(c.hiveMind.pullMode)],
    hiveMindUrl: ["hiveMindUrl", fmt(c.hiveMind.url)],

    // ── Screening+ (zen) ──
    screeningSource: ["screeningSource", fmt(c.screening.source)],
    screeningCategories: ["screeningCategories", fmt(c.screening.categories)],

    // ── Screening-GMGN (zen) ──
    "gmgn.interval": ["interval", fmt(c.gmgn.interval)],
    "gmgn.orderBy": ["orderBy", fmt(c.gmgn.orderBy)],
    "gmgn.direction": ["direction", fmt(c.gmgn.direction)],
    "gmgn.platforms": ["platforms", fmt(c.gmgn.platforms)],
    "gmgn.filters": ["filters", fmt(c.gmgn.filters)],
    "gmgn.minMcap": ["minMcap", fmt(c.gmgn.minMcap)],
    "gmgn.maxMcap": ["maxMcap", fmt(c.gmgn.maxMcap)],
    "gmgn.minTvl": ["minTvl", fmt(c.gmgn.minTvl)],
    "gmgn.minVolume": ["minVolume", fmt(c.gmgn.minVolume)],
    "gmgn.minHolders": ["minHolders", fmt(c.gmgn.minHolders)],
    "gmgn.minTokenAgeHours": ["minTokenAgeHours", fmt(c.gmgn.minTokenAgeHours)],
    "gmgn.maxTokenAgeHours": ["maxTokenAgeHours", fmt(c.gmgn.maxTokenAgeHours)],
    "gmgn.athFilterPct": ["athFilterPct", fmt(c.gmgn.athFilterPct)],
    "gmgn.minTotalFeeSol": ["minTotalFeeSol", fmt(c.gmgn.minTotalFeeSol)],
    "gmgn.requireKol": ["requireKol", fmt(c.gmgn.requireKol)],
    "gmgn.minKolCount": ["minKolCount", fmt(c.gmgn.minKolCount)],
    "gmgn.minSmartDegenCount": ["minSmartDegenCount", fmt(c.gmgn.minSmartDegenCount)],
    "gmgn.maxRugRatio": ["maxRugRatio", fmt(c.gmgn.maxRugRatio)],
    "gmgn.maxBundlerRate": ["maxBundlerRate", fmt(c.gmgn.maxBundlerRate)],
    "gmgn.maxRatTraderRate": ["maxRatTraderRate", fmt(c.gmgn.maxRatTraderRate)],
    "gmgn.maxFreshWalletRate": ["maxFreshWalletRate", fmt(c.gmgn.maxFreshWalletRate)],
    "gmgn.maxDevTeamHoldRate": ["maxDevTeamHoldRate", fmt(c.gmgn.maxDevTeamHoldRate)],
    "gmgn.maxBotDegenRate": ["maxBotDegenRate", fmt(c.gmgn.maxBotDegenRate)],
    "gmgn.maxSniperCount": ["maxSniperCount", fmt(c.gmgn.maxSniperCount)],
    "gmgn.maxSniperHoldRate": ["maxSniperHoldRate", fmt(c.gmgn.maxSniperHoldRate)],
    "gmgn.preferredKolNames": ["preferredKolNames", fmt(c.gmgn.preferredKolNames)],
    "gmgn.preferredKolMinHoldPct": ["preferredKolMinHoldPct", fmt(c.gmgn.preferredKolMinHoldPct)],
    "gmgn.dumpKolNames": ["dumpKolNames", fmt(c.gmgn.dumpKolNames)],
    "gmgn.dumpKolMinHoldPct": ["dumpKolMinHoldPct", fmt(c.gmgn.dumpKolMinHoldPct)],
    "gmgn.indicatorFilter": ["indicatorFilter", fmt(c.gmgn.indicatorFilter)],
    "gmgn.indicatorInterval": ["indicatorInterval", fmt(c.gmgn.indicatorInterval)],
    "gmgn.rules.requireBullishSupertrend": ["rules.requireBullishSupertrend", fmt(ir.requireBullishSupertrend)],
    "gmgn.rules.rejectAlreadyAtBottom": ["rules.rejectAlreadyAtBottom", fmt(ir.rejectAlreadyAtBottom)],
    "gmgn.rules.requireAboveSupertrend": ["rules.requireAboveSupertrend", fmt(ir.requireAboveSupertrend)],
    "gmgn.rules.minRsi": ["rules.minRsi", fmt(ir.minRsi)],
    "gmgn.rules.maxRsi": ["rules.maxRsi", fmt(ir.maxRsi)],
    "gmgn.rules.requireBbPosition": ["rules.requireBbPosition", fmt(ir.requireBbPosition)],

    // ── Management+ (zen) ──
    sizingMode: ["sizingMode", `${fmt(c.management.sizingMode)}${c.management.sizingMode === "maximize" ? " (bagi modal rata across slot)" : " (pabrik: pct×wallet)"}`],
    rentPerPositionSol: ["rentPerPositionSol", `${fmt(c.management.rentPerPositionSol)}${(c.management.rentPerPositionSol ?? 0) > 0 ? " 🟢 (dicadangkan/posisi)" : " ⚪ (off)"}`],
    gasReserveAutoTune: ["gasReserveAutoTune", fmt(c.management.gasReserveAutoTune)],
    gasReserveBufferDays: ["gasReserveBufferDays", fmt(c.management.gasReserveBufferDays)],
    gasReserveFloorSol: ["gasReserveFloorSol", fmt(c.management.gasReserveFloorSol)],

    // ── Strategy+ (zen) ──
    strategyLock: ["strategyLock", fmt(c.strategy.strategyLock ?? "default")],

    // ── Schedule+ (zen) ──
    adaptiveScreening: ["adaptiveScreening", fmt(c.schedule.adaptiveScreening)],
    maxScreeningIntervalMin: ["maxScreeningIntervalMin", fmt(c.schedule.maxScreeningIntervalMin)],

    // ── LLM+ (zen) ──
    generalMaxTokens: ["generalMaxTokens", fmt(c.llm.generalMaxTokens)],

    // ── Indicators+ (zen) ──
    exitEnabled: ["exitEnabled", fmt(c.indicators.exitEnabled)],
    rejectAlreadyAtBottom: ["rejectAlreadyAtBottom", fmt(c.indicators.rejectAlreadyAtBottom)],
    smiPdLookback: ["smiPdLookback", fmt(c.indicators.smiPdLookback)],
    smiPaLookback: ["smiPaLookback", fmt(c.indicators.smiPaLookback)],
    smiCrossWindow: ["smiCrossWindow", fmt(c.indicators.smiCrossWindow)],

    // ── Reports (zen) ──
    learningReportEvery: ["learningReportEvery", `${fmt(c.reports?.learningReportEvery)}${c.reports?.learningReportEvery > 0 ? " 🟢 (ON)" : " ⚪ (OFF)"}`],
    learningReportTrendN: ["learningReportTrendN", fmt(c.reports?.learningReportTrendN)],

    // ── Learning/Evolve (zen) ──
    evolveEnabled: ["evolveEnabled", `${fmt(c.learning?.evolveEnabled)}${c.learning?.evolveEnabled === false ? " (auto-evolve BEKU — threshold manual)" : " (auto-evolve aktif)"}`],

    // ── 🧪 Experiments (zen) ──
    exitLiquidityCheck: ["exitLiquidityCheck", fmt(c.experiments?.exitLiquidityCheck)],
    exitLiquidityMaxSlippagePct: ["exitLiquidityMaxSlippagePct", fmt(c.experiments?.exitLiquidityMaxSlippagePct)],
    marketRegimeGate: ["marketRegimeGate", fmt(c.experiments?.marketRegimeGate)],
    marketRegimeMaxDrop24hPct: ["marketRegimeMaxDrop24hPct", fmt(c.experiments?.marketRegimeMaxDrop24hPct)],
    candidateMomentum: ["candidateMomentum", fmt(c.experiments?.candidateMomentum)],
    narrativeProfileSignal: ["narrativeProfileSignal", fmt(c.experiments?.narrativeProfileSignal)],
    expectedYieldSignal: ["expectedYieldSignal", fmt(c.experiments?.expectedYieldSignal)],
    convictionSizing: ["convictionSizing", fmt(c.experiments?.convictionSizing)],
    convictionSizingMaxAdjustPct: ["convictionSizingMaxAdjustPct", fmt(c.experiments?.convictionSizingMaxAdjustPct)],
    counterfactualReview: ["counterfactualReview", fmt(c.experiments?.counterfactualReview)],
    counterfactualMinMcapGainPct: ["counterfactualMinMcapGainPct", fmt(c.experiments?.counterfactualMinMcapGainPct)],
    smartWalletMomentum: ["smartWalletMomentum", fmt(c.experiments?.smartWalletMomentum)],
    idleScreeningCooldown: ["idleScreeningCooldown", fmt(c.experiments?.idleScreeningCooldown)],
    idleScreeningCooldownMin: ["idleScreeningCooldownMin", fmt(c.experiments?.idleScreeningCooldownMin)],
    paperTrading: ["paperTrading", `${fmt(c.experiments?.paperTrading)}${c.experiments?.paperTrading ? " (DRY-RUN sim)" : ""}`],
    usePaperHistoryWhenLive: ["usePaperHistoryWhenLive", `${fmt(c.experiments?.usePaperHistoryWhenLive)}${c.experiments?.usePaperHistoryWhenLive ? " (live: paper=soft ref)" : ""}`],
  };

  return rowMap;
}

// formatIdentityLines: fork index.js:1719 (wrap formatIdentity, fail-open).
function formatIdentityLines() {
  try { return formatIdentity(); } catch { return "🧬 Profil: —\n🗂️ Racikan: —"; }
}

// activeRacikanName: fork index.js:2032 (fail-open → "—").
function activeRacikanName() {
  try { return getActiveSetupStatus().name || "—"; } catch { return "—"; }
}

// subgroupDesc: fork index.js:1991 VERBATIM (GMGN block flip).
function subgroupDesc(sg) {
  if (sg.id !== "zen-gmgn") return sg.desc;
  return String(config.screening.source).toLowerCase() === "gmgn"
    ? "Pipeline screening GMGN AKTIF (source=gmgn)."
    : `Pipeline screening GMGN tidak aktif (source=${config.screening.source}, blok ini diabaikan).`;
}

// formatCoreConfig: fork index.js:2016 VERBATIM.
export function formatCoreConfig() {
  const rowMap = buildConfigRowMap();
  const blocks = CORE_GROUPS.map((g) => {
    const items = g.keys.filter(([k]) => rowMap[k]).map(([k, name]) => `${name}: ${rowMap[k][1]}`);
    const lines = [];
    for (let i = 0; i < items.length; i += 2) lines.push("  " + items.slice(i, i + 2).join("  ·  "));
    return `${g.emoji} ${g.title}\n${lines.join("\n")}`;
  });
  let racikan;
  try { racikan = formatIdentityLines(); } catch { racikan = "🧬 Profil: —\n🗂️ Racikan: —"; }
  const head = "⚙️ Config inti (core) · 🟢 on · ⚪ off";
  const tail = "(ketik /config buat lihat semua)";
  return `${head}\n\n${racikan}\n\n${blocks.join("\n\n")}\n\n${tail}`;
}

// formatFunctionConfig: fork index.js:2039 VERBATIM (view mode "function").
export function formatFunctionConfig() {
  return render(configView.buildView({
    mode: "function",
    rowMap: buildConfigRowMap(),
    identity: formatIdentityLines(),
    racikanName: activeRacikanName(),
    screeningSource: config.screening.source,
  }), "telegram");
}

// formatFullConfig: fork index.js:2003 VERBATIM (view mode "origin").
export function formatFullConfig() {
  return render(configView.buildView({
    mode: "origin",
    rowMap: buildConfigRowMap(),
    identity: formatIdentityLines(),
    racikanName: activeRacikanName(),
    subgroupDesc,
  }), "telegram");
}

// ── Handlers ─────────────────────────────────────────────────────────────────
// /status — komposit Wallet + Performa + Sistem.
async function handleStatus() {
  const [wallet, positions, orBalance, orCredits] = await Promise.all([
    getWalletBalances(),
    getMyPositions({ force: true }),
    getOpenRouterBalance().catch(() => null),
    getOpenRouterCredits().catch(() => null),
  ]);
  // Held rent across open positions → total tertahan (info; SOL bebas tak dikurangi).
  let rentInfo = null;
  if (positions.total_positions > 0) {
    const rentMap = await getPositionsRentSol(positions.positions.map((p) => p.position)).catch(() => ({}));
    const vals = Object.values(rentMap);
    rentInfo = { totalRentSol: vals.reduce((s, r) => s + (r?.sol ?? 0), 0), estimated: vals.some((r) => r?.estimated) };
  }
  const slotsRemaining = Math.max(1, config.risk.maxPositions - (positions?.total_positions ?? 0));
  const { lessons } = listLessons({ limit: 10, full: true });
  const lastBad = lessons.filter((l) => l.outcome === "bad" || l.outcome === "poor").slice(-1)[0];
  const lastGood = lessons.filter((l) => l.outcome === "good").slice(-1)[0];
  const vm = statusView.buildView({
    cfg: config,
    sol: wallet.sol, solUsd: wallet.sol_usd, solPrice: wallet.sol_price,
    totalPositions: positions.total_positions, maxPositions: config.risk.maxPositions,
    deployAmount: computeDeployAmount(wallet.sol, { slotsRemaining }),
    gasReserve: config.management?.gasReserve ?? 0,
    heldSol: rentInfo?.totalRentSol ?? 0, heldEst: rentInfo?.estimated ?? false,
    dryRun: process.env.DRY_RUN === "true", hive: isHiveMindEnabled(),
    orLines: buildOpenRouterLines(orBalance, orCredits),
    perf: getPerformanceSummary(),
    lastGoodRule: lastGood ? condenseRule(lastGood.rule) : null,
    lastBadRule: lastBad ? condenseRule(lastBad.rule) : null,
    pnlBlock: formatPnlTracker(getModePerformance(), { solPriceUsd: wallet?.sol_price ?? null }),
    disclosure: racikanScopeDisclosure(),
  });
  await sendHTML(render(vm, "telegram"));
}

// /wallet — blok wallet + Sistem + tracker SOL + realized PnL. solTracker & pnlBlock
// AKTIF (dep tersedia).
async function handleWallet() {
  const [wallet, positions, orBalance, orCredits] = await Promise.all([
    getWalletBalances(),
    getMyPositions({ force: true }),
    getOpenRouterBalance().catch(() => null),
    getOpenRouterCredits().catch(() => null),
  ]);
  // Held rent across open positions → total tertahan (info; SOL bebas tak dikurangi).
  let rentInfo = null;
  if (positions.total_positions > 0) {
    const rentMap = await getPositionsRentSol(positions.positions.map((p) => p.position)).catch(() => ({}));
    const vals = Object.values(rentMap);
    rentInfo = { totalRentSol: vals.reduce((s, r) => s + (r?.sol ?? 0), 0), estimated: vals.some((r) => r?.estimated) };
  }
  const slotsRemaining = Math.max(1, config.risk.maxPositions - (positions?.total_positions ?? 0));
  const vm = walletView.buildView({
    cfg: config,
    sol: wallet.sol, solUsd: wallet.sol_usd, solPrice: wallet.sol_price,
    totalPositions: positions.total_positions, maxPositions: config.risk.maxPositions,
    deployAmount: computeDeployAmount(wallet.sol, { slotsRemaining }),
    gasReserve: config.management?.gasReserve ?? 0,
    heldSol: rentInfo?.totalRentSol ?? 0, heldEst: rentInfo?.estimated ?? false,
    dryRun: process.env.DRY_RUN === "true", hive: isHiveMindEnabled(),
    orLines: buildOpenRouterLines(orBalance, orCredits),
    solTracker: formatSolTracker(wallet.sol),
    pnlBlock: formatPnlTracker(getModePerformance(), { solPriceUsd: wallet?.sol_price ?? null }),
    disclosure: racikanScopeDisclosure(),
  });
  await sendHTML(render(vm, "telegram"));
}

// /config [core|origin] — plain-text (auto-split @4096 via splitText). rowMap + view
// verbatim fork; nol pengurangan detail (safety-net orphan di view menjaga parity).
async function handleConfig(text) {
  let out;
  if (text === "/config core") out = formatCoreConfig();
  else if (text === "/config origin") out = formatFullConfig();
  else out = formatFunctionConfig();
  await sendPlain(out);
}

// /pool <n> — detail satu posisi.
async function handlePool(text) {
  const m = text.match(/^\/pool\s+(\d+)$/i);
  const idx = parseInt(m[1]) - 1;
  const { positions } = await getMyPositions({ force: true });
  if (idx < 0 || idx >= positions.length) {
    await sendMessage(systemView.renderError("Invalid number. Use /positions first."));
    return;
  }
  const pos = positions[idx];
  const tracked = (() => { try { return getTrackedPosition(pos.position); } catch { return null; } })();
  const rent = (await getPositionsRentSol([pos.position]).catch(() => ({})))[pos.position];
  const solPrice = (await getSolMarketRegime().catch(() => null))?.usdPrice || null;
  const vm = poolView.buildView({
    cfg: config, idx, pair: pos.pair, inRange: !!pos.in_range,
    poolAddr: pos.pool, positionAddr: pos.position,
    pnlPct: pos.pnl_pct, pnlVal: pos.pnl_usd ?? 0,
    value: pos.total_value_usd, fees: pos.unclaimed_fees_usd,
    collectedFees: pos.collected_fees_usd, unclaimedFees: pos.unclaimed_fees_usd,
    ageMin: pos.age_minutes,
    heldSol: rent ? rent.sol : null, heldEst: rent ? rent.estimated : false,
    note: pos.instruction || null,
    rangeEffLines: buildRangeEfficiencyLines(pos, tracked),
    solPrice,
  });
  await sendHTML(render(vm, "telegram"));
}

// /positions — daftar posisi bernomor via views/positions.js.
async function handlePositions() {
  const { positions, total_positions } = await getMyPositions({ force: true });
  if (total_positions === 0) { await sendMessage(`${ICON.position} No open positions.`); return; }
  const rentMap = await getPositionsRentSol(positions.map((p) => p.position)).catch(() => ({}));
  const solPrice = (await getSolMarketRegime().catch(() => null))?.usdPrice || null;
  const vm = positionsView.buildView(positions, config, rentMap, solPrice);
  await sendHTML(render(vm, "telegram"));
}

export function register(hooks) {
  hooks.on("telegram:command", async (ctx) => {
    const text = String(ctx.text || "");
    if (text === "/status") {
      try { await handleStatus(); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      ctx.handled = true;
      return;
    }
    if (text === "/wallet") {
      try { await handleWallet(); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      ctx.handled = true;
      return;
    }
    if (text === "/config" || text === "/config core" || text === "/config origin") {
      try { await handleConfig(text); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      ctx.handled = true;
      return;
    }
    if (/^\/pool\s+\d+$/i.test(text)) {
      try { await handlePool(text); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      ctx.handled = true;
      return;
    }
    if (text === "/positions") {
      try { await handlePositions(); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      ctx.handled = true;
      return;
    }
    // command lain: biarkan jatuh ke rantai vanilla
  }, 100);
}
