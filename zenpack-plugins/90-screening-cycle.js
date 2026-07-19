// Stage 7.8-C: fork screening-cycle orchestration behind the core lifecycle hook.
import { agentLoop as realAgentLoop } from "../agent.js";
import { log } from "../logger.js";
import { getMyPositions as realGetMyPositions, getActiveBin as realGetActiveBin } from "../tools/dlmm.js";
import { getWalletBalances as realGetWalletBalances, getSolMarketRegime as realGetSolMarketRegime } from "../tools/wallet.js";
import { getTopCandidates as realGetTopCandidates, formatYieldToMe } from "../tools/screening.js";
import { formatGmgnCandidateForPrompt } from "../tools/gmgn.js";
import { config } from "../config.js";
import { getActiveStrategy as realGetActiveStrategy } from "../strategy-library.js";
import { recallForPool as realRecallForPool } from "../pool-memory.js";
import {
  recordCandidateSnapshots as realRecordCandidateSnapshots,
  getCandidateMomentum as realGetCandidateMomentum,
  formatCandidateMomentum as realFormatCandidateMomentum,
  recordSmartWalletCounts as realRecordSmartWalletCounts,
  getSmartWalletMomentum as realGetSmartWalletMomentum,
  formatSmartWalletMomentum as realFormatSmartWalletMomentum,
} from "../candidate-memory.js";
import { checkSmartWalletsOnPool as realCheckSmartWalletsOnPool } from "../smart-wallets.js";
import { getTokenNarrative as realGetTokenNarrative, getTokenInfo as realGetTokenInfo } from "../tools/token.js";
import { stageSignals as realStageSignals } from "../signal-tracker.js";
import { getWeightsSummary as realGetWeightsSummary } from "../signal-weights.js";
import { appendDecision as realAppendDecision } from "../decision-log.js";
import {
  isEnabled as realTelegramEnabled, createLiveMessage as realCreateLiveMessage,
  sendMessage as realSendMessage,
} from "../telegram.js";
import {
  cycleSkip, cycleFail, buildNoCandidates, buildLoneNoDeploy, CYCLE_TITLE,
} from "../views/cycle.js";
import { computeDeployAmount, minDeployAmount } from "../zenpack-lib/sizing.js";

export const manifest = { name: "zenpack-screening-cycle", priority: 100 };

const runtime = {
  agentLoop: realAgentLoop,
  getMyPositions: realGetMyPositions,
  getActiveBin: realGetActiveBin,
  getWalletBalances: realGetWalletBalances,
  getSolMarketRegime: realGetSolMarketRegime,
  getTopCandidates: realGetTopCandidates,
  getActiveStrategy: realGetActiveStrategy,
  recallForPool: realRecallForPool,
  recordCandidateSnapshots: realRecordCandidateSnapshots,
  recordSmartWalletCounts: realRecordSmartWalletCounts,
  getCandidateMomentum: realGetCandidateMomentum,
  formatCandidateMomentum: realFormatCandidateMomentum,
  getSmartWalletMomentum: realGetSmartWalletMomentum,
  formatSmartWalletMomentum: realFormatSmartWalletMomentum,
  checkSmartWalletsOnPool: realCheckSmartWalletsOnPool,
  getTokenNarrative: realGetTokenNarrative,
  getTokenInfo: realGetTokenInfo,
  stageSignals: realStageSignals,
  getWeightsSummary: realGetWeightsSummary,
  appendDecision: realAppendDecision,
  telegramEnabled: realTelegramEnabled,
  createLiveMessage: realCreateLiveMessage,
  sendMessage: realSendMessage,
};

function stripThink(text) {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function sanitizeUntrustedPromptText(text, maxLen = 500) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[<>`]/g, "")
    .trim()
    .slice(0, maxLen);
  return cleaned ? JSON.stringify(cleaned) : null;
}


function buildGmgnFunnelReport(stageCounts, allFiltered = [], { fromStage = 1 } = {}) {
  if (!stageCounts) return null;
  const sc = stageCounts;
  const funnel = `GMGN funnel: ranked=${sc.ranked ?? "?"} → S1=${sc.s1 ?? "?"} → S2=${sc.s2 ?? "?"} → S3=${sc.s3 ?? "?"} → S4=${sc.s4 ?? "?"} → final=${sc.s5 ?? "?"}`;
  const byStage = {};
  for (const f of allFiltered) {
    if (f.stage < fromStage) continue;
    const key = `s${f.stage}`;
    if (!byStage[key]) byStage[key] = [];
    byStage[key].push(`${f.name}: ${f.reason}`);
  }
  const stageLabels = { s2: "S2 info", s3: "S3 pool", s4: "S4 indicators", s5: "S5 pick" };
  const details = Object.entries(byStage)
    .map(([key, items]) => `${stageLabels[key] || key}:\n${items.map(r => `  • ${r}`).join("\n")}`)
    .join("\n");
  return details ? `${funnel}\n\n${details}` : funnel;
}

function getLoneCandidateSkipReason({ pool, sw, n, ti } = {}) {
  if (!pool) return "missing candidate data";
  const smartWalletCount = Math.max(sw?.in_pool?.length ?? 0, Number(pool.gmgn_smart_wallets ?? 0) || 0);
  const tokenInfo = ti || {};
  const hasNarrative = !!n?.narrative;
  const globalFeesSol = Number(tokenInfo.global_fees_sol ?? pool.gmgn_total_fee_sol);
  const top10Pct = Number(tokenInfo.audit?.top_holders_pct ?? pool.gmgn_token_info_top10_pct ?? pool.gmgn_top10_holder_pct);
  const botPct = Number(tokenInfo.audit?.bot_holders_pct ?? pool.gmgn_bot_degen_pct);
  if (pool.is_wash) return "wash trading was flagged";
  if (pool.is_rugpull && smartWalletCount === 0) return "rugpull risk was flagged and no smart wallets offset it";
  if (pool.is_pvp && smartWalletCount === 0) return "PVP symbol conflict and no smart-wallet confirmation";
  if (Number.isFinite(globalFeesSol) && globalFeesSol < config.screening.minTokenFeesSol) {
    return `token fees ${globalFeesSol} SOL below minimum ${config.screening.minTokenFeesSol} SOL`;
  }
  if (Number.isFinite(top10Pct) && top10Pct > config.screening.maxTop10Pct) {
    return `top10 concentration ${top10Pct}% above maximum ${config.screening.maxTop10Pct}%`;
  }
  if (Number.isFinite(botPct) && botPct > config.screening.maxBotHoldersPct) {
    return `bot holders ${botPct}% above maximum ${config.screening.maxBotHoldersPct}%`;
  }
  if (!hasNarrative && smartWalletCount === 0) return "only candidate has no narrative and no smart-wallet confirmation";
  return null;
}

export async function runScreeningCycle(ctx = {}) {
  const { silent = false } = ctx;
  const {
    agentLoop, getMyPositions, getActiveBin, getWalletBalances, getSolMarketRegime,
    getTopCandidates, getActiveStrategy, recallForPool, recordCandidateSnapshots,
    recordSmartWalletCounts, getCandidateMomentum, formatCandidateMomentum,
    getSmartWalletMomentum, formatSmartWalletMomentum, checkSmartWalletsOnPool,
    getTokenNarrative, getTokenInfo, stageSignals, getWeightsSummary, appendDecision,
    telegramEnabled, createLiveMessage, sendMessage,
  } = ctx.runtime || runtime;

  // Hard guards — don't even run the agent if preconditions aren't met
  let prePositions, preBalance;
  let liveMessage = null;
  let screenReport = null;
  try {
    [prePositions, preBalance] = await Promise.all([getMyPositions({ force: true }), getWalletBalances()]);
    if (prePositions.total_positions >= config.risk.maxPositions) {
      log("cron", `Screening skipped — max positions reached (${prePositions.total_positions}/${config.risk.maxPositions})`);
      screenReport = cycleSkip(`Screening skipped — max positions reached (${prePositions.total_positions}/${config.risk.maxPositions}).`);
      appendDecision({
        type: "skip",
        actor: "SCREENER",
        summary: "Screening skipped",
        reason: `Max positions reached (${prePositions.total_positions}/${config.risk.maxPositions})`,
      });
      return screenReport;
    }
    // Broke-skip: bail BEFORE any candidate fetch or the (expensive) screening LLM
    // when we can't open a new position at the min-deploy floor. Sizing-aware: ask
    // computeDeployAmount for the REAL per-slot amount (maximize reserves gas + rent
    // per slot and returns 0 when the wallet can't size one slot ≥ min) and also
    // require the wallet to actually afford that one position + gas + rent (covers
    // fixed mode, whose floor ignores affordability). The old check compared only
    // deployAmountSol + gasReserve — it ignored rent AND adaptive slot sizing, so a
    // 0.334 SOL wallet sailed past it and burned the LLM on a 0.095/slot deploy the
    // safety floor would always reject (the stuck-retry bug).
    const isDryRun = process.env.DRY_RUN === "true";
    const slotsRemaining = Math.max(1, config.risk.maxPositions - prePositions.total_positions);
    const plannedDeploy = computeDeployAmount(preBalance.sol, { slotsRemaining });
    const rentReserve = Math.max(0, config.management.rentPerPositionSol ?? 0);
    const needForOne = plannedDeploy + config.management.gasReserve + rentReserve;
    if (!isDryRun && (plannedDeploy < minDeployAmount() || preBalance.sol < needForOne)) {
      const needNote = (minDeployAmount() + config.management.gasReserve + rentReserve).toFixed(3);
      log("cron", `Screening skipped — modal kurang (wallet ${preBalance.sol.toFixed(3)} SOL, sizing/slot ${plannedDeploy} < min ${minDeployAmount()}; butuh ~${needNote} SOL utk 1 posisi). No LLM call.`);
      screenReport = cycleSkip(`Screening skipped — modal kurang (wallet ${preBalance.sol.toFixed(3)} SOL < ~${needNote} untuk 1 posisi ≥ ${minDeployAmount()} SOL + gas + rent).`);
      appendDecision({
        type: "skip",
        actor: "SCREENER",
        summary: "Screening skipped — modal kurang",
        reason: `Sizing/slot ${plannedDeploy} < min ${minDeployAmount()} (wallet ${preBalance.sol.toFixed(3)})`,
      });
      return screenReport;
    }

    // ─── 🧪 Experiment #4: market regime gate ─────────────────
    // OFF by default → skipped entirely (factory behavior). When ON, read SOL's
    // 24h price change (Jupiter price, read-only). If SOL is down more than the
    // limit, the market is risk-off — skip the whole screening cycle (no LLM
    // call, no new deploy). Catches scheduled + freed-slot screening. Fail-open:
    // a price hiccup must never block screening, so wrap and swallow errors here.
    if (config.experiments?.marketRegimeGate) {
      try {
        const maxDrop = Number(config.experiments.marketRegimeMaxDrop24hPct ?? 8);
        const regime = await getSolMarketRegime();
        if (regime && Number.isFinite(regime.change24hPct) && regime.change24hPct < -maxDrop) {
          const msg = `risk-off: SOL ${regime.change24hPct.toFixed(1)}% (24h) < -${maxDrop}% limit`;
          log("experiment", `marketRegimeGate: skipping screening — ${msg}`);
          screenReport = `🧪 Screening skipped — market ${msg} (experimental gate).`;
          appendDecision({
            type: "skip",
            actor: "SCREENER",
            summary: "Screening skipped",
            reason: `🧪 market ${msg}`,
          });
          return screenReport;
        }
        if (regime) {
          log("experiment", `marketRegimeGate: SOL ${regime.change24hPct.toFixed(1)}% (24h) — risk-on (limit -${maxDrop}%)`);
        }
      } catch (e) {
        log("experiment", `marketRegimeGate failed — allowing screening (fail-open): ${e.message}`);
      }
    }
  } catch (e) {
    log("cron_error", `Screening pre-check failed: ${e.message}`);
    screenReport = cycleFail(`Screening pre-check failed: ${e.message}`);
    return screenReport;
  }
  if (!silent && telegramEnabled()) {
    liveMessage = await createLiveMessage(CYCLE_TITLE.screen, "Scanning candidates...");
  }
  ctx.markStarted();
  log("cron", `Starting screening cycle [model: ${config.llm.screeningModel}]`);
  try {
    // Reuse pre-fetched balance — no extra RPC call needed
    const currentBalance = preBalance;
    // "maximize" sizing splits the wallet across the slots still open; "fixed"
    // ignores slotsRemaining. prePositions is the fresh force:true count above.
    const slotsRemaining = Math.max(1, config.risk.maxPositions - prePositions.total_positions);
    const deployAmount = computeDeployAmount(currentBalance.sol, { slotsRemaining });
    log("cron", `Computed deploy amount: ${deployAmount} SOL (wallet: ${currentBalance.sol} SOL, slots left: ${slotsRemaining}, mode: ${config.management.sizingMode})`);

    // Load active strategy
    const activeStrategy = getActiveStrategy();
    // strategyLock != default → the lock value IS the strategy (enforced in executor);
    // default → flexible, config.strategy.strategy is the fallback default.
    const stratLock = config.strategy.strategyLock ?? "default";
    const deployStrategy = stratLock !== "default" ? stratLock : config.strategy.strategy;
    const strategyBlock = `DEPLOY STRATEGY: ${deployStrategy} ${stratLock !== "default" ? "(LOCKED by strategyLock — enforced, do not deviate)" : "(default from config — may deviate per pool if clearly justified)"} | bins_above: 0 (FIXED — never change) | deposit: SOL only (amount_y, amount_x=0)`
      + (activeStrategy ? `\nSTRATEGY CONTEXT: ${activeStrategy.name} — entry: ${activeStrategy.entry?.condition || "n/a"} | exit: ${activeStrategy.exit?.notes || "n/a"} | best for: ${activeStrategy.best_for}` : "");

    // Fetch top candidates, then recon each sequentially with a small delay to avoid 429s
    const topCandidates = await getTopCandidates({ limit: 10 }).catch((e) => ({ _error: e.message }));
    if (topCandidates?._error) {
      screenReport = cycleFail(`Screening failed: ${topCandidates._error}`);
      return screenReport;
    }
    const candidates = (topCandidates?.candidates || topCandidates?.pools || []).slice(0, 10);

    // 🔬 Shadow-logging data layer: ALWAYS record candidate snapshots (cheap, 24h
    // ephemeral) so momentum / sw-momentum / counterfactual have data to read AND
    // so we can freeze a pool's signal values onto a position at deploy — even when
    // the experiments are OFF (recording ≠ influencing; deploys stay neutral).
    // The experiment flags now only gate whether the signal is shown to the LLM.
    // Fail-open: a snapshot hiccup must never derail screening.
    try {
      recordCandidateSnapshots(candidates);
    } catch (e) {
      log("experiment", `candidate snapshot failed — continuing (fail-open): ${e.message}`);
    }

    const earlyFilteredExamples = topCandidates?.filtered_examples || [];
    const gmgnStageCounts = topCandidates?.stage_counts ?? null;
    const gmgnAllFiltered = topCandidates?.all_filtered ?? [];

    const allCandidates = [];
    for (const pool of candidates) {
      const mint = pool.base?.mint;
      const [smartWallets, narrative, tokenInfo] = await Promise.allSettled([
        checkSmartWalletsOnPool({ pool_address: pool.pool }),
        mint ? getTokenNarrative({ mint }) : Promise.resolve(null),
        mint ? getTokenInfo({ query: mint }) : Promise.resolve(null),
      ]);
      allCandidates.push({
        pool,
        sw: smartWallets.status === "fulfilled" ? smartWallets.value : null,
        n: narrative.status === "fulfilled" ? narrative.value : null,
        ti: tokenInfo.status === "fulfilled" ? tokenInfo.value?.results?.[0] : null,
        mem: recallForPool(pool.pool),
      });
      await new Promise(r => setTimeout(r, 150)); // avoid 429s
    }

    // Hard filters after token recon — block launchpads and excessive Jupiter bot holders
    // Skipped for GMGN: platforms already filtered upstream; bundler/bot data from GMGN pipeline
    const filteredOut = [];
    const passing = allCandidates.filter(({ pool, ti }) => {
      if (pool.gmgn) return true;
      const launchpad = ti?.launchpad ?? null;
      if (launchpad && config.screening.allowedLaunchpads?.length > 0 && !config.screening.allowedLaunchpads.includes(launchpad)) {
        log("screening", `Skipping ${pool.name} — launchpad ${launchpad} not in allow-list`);
        filteredOut.push({ name: pool.name, reason: `launchpad ${launchpad} not in allow-list` });
        return false;
      }
      if (launchpad && config.screening.blockedLaunchpads.includes(launchpad)) {
        log("screening", `Skipping ${pool.name} — blocked launchpad (${launchpad})`);
        filteredOut.push({ name: pool.name, reason: `blocked launchpad (${launchpad})` });
        return false;
      }
      const botPct = ti?.audit?.bot_holders_pct;
      const maxBotHoldersPct = config.screening.maxBotHoldersPct;
      if (botPct != null && maxBotHoldersPct != null && botPct > maxBotHoldersPct) {
        log("screening", `Bot-holder filter: dropped ${pool.name} — bots ${botPct}% > ${maxBotHoldersPct}%`);
        filteredOut.push({ name: pool.name, reason: `bot holders ${botPct}% > ${maxBotHoldersPct}%` });
        return false;
      }
      return true;
    });

    if (passing.length === 0) {
      const combined = filteredOut.length > 0 ? filteredOut : earlyFilteredExamples;
      const combinedExamples = combined.slice(0, 5)
        .map((entry) => `- ${entry.name}: ${entry.reason}`)
        .join("\n");
      const funnelBlock = buildGmgnFunnelReport(gmgnStageCounts, gmgnAllFiltered, { fromStage: 2 });
      const thresholds = [
        `tvl > $${config.screening.minTvl}`,
        `vol > $${config.screening.minVolume}`,
        `organic > ${config.screening.minOrganic}%`,
        `holders > ${config.screening.minHolders}`,
        `fee/tvl > ${config.screening.minFeeActiveTvlRatio}%`,
      ];
      screenReport = buildNoCandidates({
        funnel: funnelBlock,
        examples: combined.slice(0, 5).map((e) => ({ name: e.name, reason: e.reason })),
        thresholds,
      });
      appendDecision({
        type: "no_deploy",
        actor: "SCREENER",
        summary: "No candidates available",
        reason: funnelBlock || combinedExamples || "All candidates filtered before deploy",
        rejected: combined.slice(0, 5).map((entry) => `${entry.name}: ${entry.reason}`),
      });
      return screenReport;
    }

    if (passing.length <= 1 && gmgnStageCounts) {
      const funnelBlock = buildGmgnFunnelReport(gmgnStageCounts, gmgnAllFiltered, { fromStage: 2 });
      if (funnelBlock) log("screening", `GMGN funnel (sparse):\n${funnelBlock}`);
    }

    if (passing.length === 1) {
      const skipReason = getLoneCandidateSkipReason(passing[0]);
      if (skipReason) {
        const candidateName = passing[0].pool?.name || "unknown";
        const funnelBlock = buildGmgnFunnelReport(gmgnStageCounts, gmgnAllFiltered, { fromStage: 2 });
        screenReport = buildLoneNoDeploy({ candidateName, skipReason, funnel: funnelBlock });
        appendDecision({
          type: "no_deploy",
          actor: "SCREENER",
          summary: "Single candidate skipped",
          reason: skipReason,
          pool: passing[0].pool?.pool,
          pool_name: candidateName,
        });
        return screenReport;
      }
    }

    // 🔬 Shadow-logging: ALWAYS record this cycle's smart-wallet count per passing
    // candidate (sw is known here) so sw-momentum has data even when the experiment
    // is off. Recording ≠ influencing. Fail-open.
    try {
      recordSmartWalletCounts(passing.map(({ pool, sw }) => ({
        addr: pool.pool,
        name: pool.name,
        sw_count: sw?.in_pool?.length ?? 0,
      })));
    } catch (e) {
      log("experiment", `smartWalletMomentum record failed — continuing (fail-open): ${e.message}`);
    }

    // Pre-fetch active_bin for all passing candidates in parallel
    const activeBinResults = await Promise.allSettled(
      passing.map(({ pool }) => getActiveBin({ pool_address: pool.pool }))
    );

    // Build compact candidate blocks
    const candidateBlocks = passing.map(({ pool, sw, n, ti, mem }, i) => {
      const botPct = ti?.audit?.bot_holders_pct ?? "?";
      const top10Pct = ti?.audit?.top_holders_pct ?? "?";
      const feesSol = ti?.global_fees_sol ?? "?";
      const launchpad = ti?.launchpad ?? null;
      const priceChange = ti?.stats_1h?.price_change;
      const netBuyers = ti?.stats_1h?.net_buyers;
      const activeBin = activeBinResults[i]?.status === "fulfilled" ? activeBinResults[i].value?.binId : null;

      // 🧪 Experiment #1: candidate momentum — soft, trusted line (our own metric
      // deltas, not external text). OFF by default → momentumLine stays null and
      // drops out of the block. Fail-open.
      let momentumLine = null;
      if (config.experiments?.candidateMomentum) {
        try {
          const txt = formatCandidateMomentum(getCandidateMomentum(pool.pool));
          if (txt) momentumLine = `  momentum: ${txt}`;
        } catch { /* fail-open — omit the line */ }
      }

      // 🧪 Experiment #2: expected yield-to-me (proxy) — soft, trusted line (our
      // own footprint + fee-capture estimate, not external text). OFF by default →
      // yieldLine stays null and drops out of the block. Fail-open.
      let yieldLine = null;
      if (config.experiments?.expectedYieldSignal) {
        try {
          const txt = formatYieldToMe({
            deployAmountSol: deployAmount,
            solPriceUsd: currentBalance.sol_price,
            tvlUsd: pool.tvl ?? pool.active_tvl,
            feeActiveTvlRatio: pool.fee_active_tvl_ratio,
          });
          if (txt) yieldLine = `  yield_to_me: ${txt}`;
        } catch { /* fail-open — omit the line */ }
      }

      // 🧪 Smart-wallet momentum: soft, trusted line — smart money entering/leaving
      // this pool across cycles. OFF by default → stays null and drops out. Fail-open.
      let swMomentumLine = null;
      if (config.experiments?.smartWalletMomentum) {
        try {
          const txt = formatSmartWalletMomentum(getSmartWalletMomentum(pool.pool));
          if (txt) swMomentumLine = `  sw_momentum: ${txt}`;
        } catch { /* fail-open — omit the line */ }
      }

      const pvpLine = pool.is_pvp
        ? `  pvp: HIGH — rival ${pool.pvp_rival_name || pool.pvp_symbol} (${pool.pvp_rival_mint?.slice(0, 8)}...) has pool ${pool.pvp_rival_pool?.slice(0, 8)}..., tvl=$${pool.pvp_rival_tvl}, holders=${pool.pvp_rival_holders}, fees=${pool.pvp_rival_fees}SOL`
        : null;
      let block;
      if (pool.gmgn) {
        block = [
          `POOL: ${pool.name} (${pool.pool})`,
          formatGmgnCandidateForPrompt(pool),
          pvpLine,
          `  smart_wallets: ${sw?.in_pool?.length ?? 0} present${sw?.in_pool?.length ? ` → CONFIDENCE BOOST (${sw.in_pool.map(w => w.name).join(", ")})` : ""}`,
          activeBin != null ? `  active_bin: ${activeBin}` : null,
          momentumLine,
          yieldLine,
          swMomentumLine,
          n?.narrative ? `  narrative_untrusted: ${sanitizeUntrustedPromptText(n.narrative, 500)}` : `  narrative_untrusted: none`,
          mem ? `  memory_untrusted: ${sanitizeUntrustedPromptText(mem, 500)}` : null,
        ].filter(Boolean).join("\n");
      } else {
        const gmgnPriceLine = pool.gmgn_price_action
          ? `  gmgn_price: rsi2=${pool.gmgn_price_action.rsi2 ?? "?"}, supertrend=${pool.gmgn_price_action.supertrend?.direction || "?"}, price_vs_ath=${pool.gmgn_price_action.priceVsAthPct ?? "?"}%, 1h_change=${pool.gmgn_price_action.priceChangePct ?? "?"}%, max_vol_candle=${pool.gmgn_price_action.maxVolumeShare ?? "?"}%`
          : null;
        block = [
          `POOL: ${pool.name} (${pool.pool})`,
          `  metrics: bin_step=${pool.bin_step}, fee_pct=${pool.fee_pct}%, fee_tvl=${pool.fee_active_tvl_ratio}, vol=$${pool.volume_window}, tvl=$${pool.tvl ?? pool.active_tvl}, volatility_${pool.volatility_timeframe || "30m"}=${pool.volatility}, mcap=$${pool.mcap}, organic=${pool.organic_score}${pool.token_age_hours != null ? `, age=${pool.token_age_hours}h` : ""}`,
          `  audit: top10=${top10Pct}%, bots=${botPct}%, fees=${feesSol}SOL${launchpad ? `, launchpad=${launchpad}` : ""}`,
          gmgnPriceLine,
          pvpLine,
          `  smart_wallets: ${sw?.in_pool?.length ?? 0} present${sw?.in_pool?.length ? ` → CONFIDENCE BOOST (${sw.in_pool.map(w => w.name).join(", ")})` : ""}`,
          activeBin != null ? `  active_bin: ${activeBin}` : null,
          priceChange != null ? `  1h: price${priceChange >= 0 ? "+" : ""}${priceChange}%, net_buyers=${netBuyers ?? "?"}` : null,
          momentumLine,
          yieldLine,
          swMomentumLine,
          n?.narrative ? `  narrative_untrusted: ${sanitizeUntrustedPromptText(n.narrative, 500)}` : `  narrative_untrusted: none`,
          mem ? `  memory_untrusted: ${sanitizeUntrustedPromptText(mem, 500)}` : null,
        ].filter(Boolean).join("\n");
      }

      // Stage signals for Darwinian weighting — captured before LLM decides
      if (config.darwin?.enabled) {
        const baseMint = pool.base?.mint || pool.base_mint || ti?.mint || null;
        stageSignals(pool.pool, {
          base_mint:             baseMint,
          organic_score:         pool.organic_score         ?? null,
          fee_tvl_ratio:         pool.fee_active_tvl_ratio  ?? null,
          volume:                pool.volume_window         ?? null,
          mcap:                  pool.mcap                  ?? null,
          holder_count:          ti?.holders                ?? null,
          smart_wallets_present: (sw?.in_pool?.length ?? 0) > 0,
          narrative_quality:     n?.narrative ? "present" : "absent",
          volatility:            pool.volatility            ?? null,
          // Logging-upgrade: concentration/age signals already fetched during
          // screening (ti.audit / pool.token_age_hours) but previously discarded.
          // Stamped here purely for post-hoc rug analysis — additive, never gates.
          entry_top10_pct:       ti?.audit?.top_holders_pct ?? null,
          entry_bot_pct:         ti?.audit?.bot_holders_pct ?? null,
          entry_age_hours:       pool.token_age_hours       ?? null,
          entry_mint_disabled:   ti?.audit?.mint_disabled   ?? null,
          entry_freeze_disabled: ti?.audit?.freeze_disabled ?? null,
          entry_dev_migrations:  ti?.audit?.dev_migrations  ?? null,
        });
      }

      return block;
    });

    const weightsSummary = config.darwin?.enabled ? getWeightsSummary() : null;

    let deployAttempted = false;
    let deploySucceeded = false;
    const { content } = await agentLoop(`
SCREENING CYCLE
${strategyBlock}
Positions: ${prePositions.total_positions}/${config.risk.maxPositions} | SOL: ${currentBalance.sol.toFixed(3)} | Deploy: ${deployAmount} SOL

PRE-LOADED CANDIDATES (${passing.length} pools):
${candidateBlocks.join("\n\n")}

Every candidate block above already carries ALL the recon you need to decide: pool metrics, audit (top10/bots/fees/launchpad), smart_wallets, active_bin, narrative, and pool memory. This data is final — judge straight from it and call deploy_position. Do NOT call get_token_info, get_token_holders, get_token_narrative, check_smart_wallets_on_pool, get_active_bin, or get_pool_memory: they only re-fetch what is already shown here and burn an extra step. Reach for a tool only if a specific value you truly need is genuinely missing from a block.

STEPS:
1. Decide whether any candidate is worth deploying. A single remaining candidate is not automatically good enough.
2. Pick the best candidate only if it has real conviction from narrative quality, smart wallets, and pool metrics. If the list has only one pool and it lacks narrative or smart-wallet confirmation, skip the cycle.
3. If a pool qualifies, call deploy_position (active_bin is pre-fetched above — no need to call get_active_bin).
   strategy = ${config.strategy.strategy} (always use this, never change it).
   bins_below = round(${config.strategy.minBinsBelow} + (candidate volatility/5)*${config.strategy.maxBinsBelow - config.strategy.minBinsBelow}) clamped to [${config.strategy.minBinsBelow},${config.strategy.maxBinsBelow}].
   pass deploy_position.volatility = the candidate volatility value.
   bins_above = 0. Single-side SOL only: set amount_y, keep amount_x = 0.
4. Report in this exact format (no tables, no extra sections):
   🚀 DEPLOYED

   <pool name>
   <pool address>

   ◎ <deploy amount> SOL | <strategy> | bin <active_bin>
   Range: <minPrice> → <maxPrice>
   Range cover: <downside %> downside | <upside %> upside | <total width %> total

   IMPORTANT:
   - Do NOT calculate the range percentages yourself.
   - Use the actual deploy_position tool result:
     range_coverage.downside_pct
     range_coverage.upside_pct
     range_coverage.width_pct

   MARKET
   Fee/TVL: <x>%
   Volume: $<x>
   TVL: $<x>
   Volatility: <x>
   Organic: <x>
   Mcap: $<x>
   Age: <x>h

   AUDIT
   Top10: <x>%
   Bots: <x>%
   Fees paid: <x> SOL
   Smart wallets: <names or none>

   WHY THIS WON
   <2-4 concise sentences on why this pool won, key risks, and why it still beat the alternatives>
5. If no pool qualifies, report in this exact format instead:
   ⛔ NO DEPLOY

   Cycle finished with no valid entry.

   BEST LOOKING CANDIDATE
   <name or none>

   WHY SKIPPED
   <2-4 concise sentences explaining why nothing was good enough>

   REJECTED
   <short flat list of top candidate names and why they were skipped>
IMPORTANT:
- Keep the whole report compact and highly scannable for Telegram.
      `, config.llm.maxSteps, [], "SCREENER", config.llm.screeningModel, 2048, {
        // Skipping ("⛔ NO DEPLOY") is a valid outcome with no tool call — don't let the
        // tool-required guard turn a legit skip into the canned "no tool call" message.
        // A claimed-but-fake deploy is caught by the deploySucceeded guard below.
        allowNoToolFinal: true,
        onToolStart: async ({ name }) => {
          if (name === "deploy_position") deployAttempted = true;
          await liveMessage?.toolStart(name);
        },
        onToolFinish: async ({ name, result, success }) => {
          if (name === "deploy_position") {
            deployAttempted = true;
            deploySucceeded = Boolean(success && result?.success !== false && !result?.error && !result?.blocked);
          }
          await liveMessage?.toolFinish(name, result, success);
        },
      });
    // Anti-hallucination guard (pairs with allowNoToolFinal above): if the model drafted
    // a 🚀 DEPLOYED report but no deploy_position actually succeeded, replace it with an
    // honest skip before it reaches Telegram — never post a fake deploy.
    let reportContent = content;
    if (!deploySucceeded && /🚀\s*DEPLOYED/i.test(content)) {
      log("cron", "Screener drafted DEPLOYED but no deploy executed — overriding report to NO DEPLOY");
      reportContent = "⛔ NO DEPLOY\n\nCycle finished with no valid entry.\n(Model drafted a deploy report but no position was actually opened.)";
    }
    // Defense-in-depth (pairs with agent.js tool-dump guard): if the model still returned
    // non-report content (e.g. raw JSON / a tool-call dump) rather than a 🚀 DEPLOYED or
    // ⛔ NO DEPLOY report, never post it to Telegram — convert to an honest skip.
    if (!deploySucceeded && !/⛔\s*NO DEPLOY/i.test(reportContent) && /^\s*[[{]/.test(stripThink(reportContent || ""))) {
      log("cron", "Screener returned non-report content (likely tool-dump) — overriding to NO DEPLOY");
      reportContent = "⛔ NO DEPLOY\n\nCycle finished with no valid entry.\n(Screening model returned malformed output instead of a report.)";
    }
    const funnelAppend = buildGmgnFunnelReport(gmgnStageCounts, gmgnAllFiltered, { fromStage: 2 });
    screenReport = funnelAppend ? `${reportContent}\n\n─────────────\n${funnelAppend}` : reportContent;
    if (/⛔\s*NO DEPLOY/i.test(reportContent)) {
      appendDecision({
        type: "no_deploy",
        actor: "SCREENER",
        summary: "LLM chose no deploy",
        reason: stripThink(reportContent).slice(0, 500),
      });
    } else if (!deploySucceeded) {
      appendDecision({
        type: "no_deploy",
        actor: "SCREENER",
        summary: deployAttempted ? "Deploy attempt did not succeed" : "No successful deploy in screening cycle",
        reason: stripThink(reportContent).slice(0, 500),
      });
    }
  } catch (error) {
    log("cron_error", `Screening cycle failed: ${error.message}`);
    screenReport = cycleFail(`Screening cycle failed: ${error.message}`);
  } finally {
    if (!silent && telegramEnabled()) {
      if (screenReport) {
        if (liveMessage) await liveMessage.finalize(stripThink(screenReport)).catch(() => {});
        else sendMessage(`${CYCLE_TITLE.screen}\n\n${stripThink(screenReport)}`).catch(() => { });
      } else if (liveMessage) {
        // Same typing-indicator leak guard as the management cycle.
        await liveMessage.finalize("(cycle ended without report)").catch(() => {});
      }
    }
  }
  return screenReport;
}

export function register(hooks) {
  hooks.on("screening:cycle", async (ctx) => {
    ctx.started = true;
    ctx.handled = true;
    ctx.result = await runScreeningCycle(ctx);
  }, 100);
}

export const __test = { runtime, buildGmgnFunnelReport, getLoneCandidateSkipReason };
