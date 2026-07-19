// Plugin 70: interactive money commands and agent fallback.
// Adaptasi minimal: Telegram owns a capped history/cache because index locals are
// not exported. Re-unify when a later phase exports a core state facade.
import { agentLoop } from "../agent.js";
import { config } from "../config.js";
import { executeTool } from "../tools/executor.js";
import { getWalletBalances } from "../tools/wallet.js";
import { getMyPositions, closePosition } from "../tools/dlmm.js";
import { getTopCandidates } from "../tools/screening.js";
import { checkSmartWalletsOnPool } from "../smart-wallets.js";
import { getTokenNarrative, getTokenInfo } from "../tools/token.js";
import { appendDecision } from "../decision-log.js";
import {
  sendMessage, sendMessageWithButtons, editMessage, answerCallbackQuery,
  createLiveMessage,
} from "../telegram.js";
import {
  buildCandidateList, buildNoCache, buildNoCandidates, buildLoneNoDeploy,
  summarizeTradeAction, buildConfigDiff, CONFIRM_OK, CONFIRM_NO, CONFIRM_EXPIRED,
} from "../views/cycle.js";
import { ICON, SEP, tree, header, fmtMoneySigned } from "../views/format.js";
import * as systemView from "../views/system.js";
import { settingValue } from "../views/settings.js";
import { computeDeployAmount, minDeployAmount } from "../zenpack-lib/sizing.js";
import {
  getLatestCandidatesMeta, resetLatestCandidates, setLatestCandidates,
} from "../zenpack-lib/candidate-cache.js";

export const manifest = { name: "zenpack-money-commands", priority: 100 };

const runtime = {
  agentLoop, executeTool, getWalletBalances, getMyPositions, closePosition,
  getTopCandidates, checkSmartWalletsOnPool, getTokenNarrative, getTokenInfo,
};

const sessionHistory = [];
const MAX_HISTORY = 20;
let _pendingConfirmation = null;

function appendHistory(userMsg, assistantMsg) {
  sessionHistory.push({ role: "user", content: userMsg });
  sessionHistory.push({ role: "assistant", content: assistantMsg });
  // Trim to last MAX_HISTORY messages
  if (sessionHistory.length > MAX_HISTORY) {
    sessionHistory.splice(0, sessionHistory.length - MAX_HISTORY);
  }
}

function describeLatestCandidates(limit = 5) {
  const { candidates, updatedAt } = getLatestCandidatesMeta();
  if (!candidates.length) return buildNoCache();
  return buildCandidateList(candidates.slice(0, limit), { updatedAt });
}

function getConfigValue(key) {
  const known = settingValue(key);
  if (known !== undefined) return known;
  for (const section of Object.values(config)) {
    if (section && typeof section === "object" && key in section) return section[key];
  }
  return undefined;
}

async function requestActionConfirmation(toolName, args) {
  const summary = summarizeTradeAction(toolName, args);
  const signature = `${toolName}:${JSON.stringify(args ?? {})}`;
  if (_pendingConfirmation) {
    return _pendingConfirmation.signature === signature ? _pendingConfirmation.promise : false;
  }

  let resolveFn;
  const promise = new Promise((resolve) => { resolveFn = resolve; });
  const pending = { promise, resolve: resolveFn, timer: null, messageId: null, signature };
  _pendingConfirmation = pending;
  pending.timer = setTimeout(async () => {
    if (_pendingConfirmation === pending) _pendingConfirmation = null;
    if (pending.messageId) await editMessage(CONFIRM_EXPIRED, pending.messageId).catch(() => {});
    resolveFn(false);
  }, 30_000);

  const sent = await sendMessageWithButtons(`⚠️ Konfirmasi aksi ini?\n${summary}`, [[
    { text: "✅ Ya", callback_data: "confirm:yes" },
    { text: "❌ Batal", callback_data: "confirm:no" },
  ]]);
  pending.messageId = sent?.result?.message_id ?? null;
  return promise;
}

async function requestConfirmation(toolName, args) {
  if (toolName !== "update_config") return requestActionConfirmation(toolName, args);
  const coerce = (v) => {
    if (typeof v !== "string") return v;
    const lc = v.trim().toLowerCase();
    if (lc === "true") return true;
    if (lc === "false") return false;
    if (lc === "off" || lc === "null") return null;
    if (v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return v;
  };
  const RESERVED = new Set(["changes", "key", "value", "path", "reason"]);
  const KNOWN_SECTIONS = new Set(["screening", "management", "risk", "schedule", "llm", "strategy", "hiveMind", "api", "gmgn", "indicators", "chartIndicators", "experiments", "reports", "tokens", "darwin", "learning"]);
  const raw = {};
  if (args.changes && typeof args.changes === "object") Object.assign(raw, args.changes);
  if (typeof args.key === "string" && args.key.trim()) raw[args.key.trim()] = args.value;
  if (typeof args.path === "string" && args.path.trim()) raw[args.path.trim().split(".").pop()] = args.value;
  for (const [k, v] of Object.entries(args)) {
    if (RESERVED.has(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && KNOWN_SECTIONS.has(k)) {
      for (const [sk, sv] of Object.entries(v)) raw[sk] = sv;
    } else if (!(k in raw) && getConfigValue(k) !== undefined) {
      raw[k] = v;
    }
  }
  const changes = {};
  for (const [k, v] of Object.entries(raw)) changes[k] = coerce(v);

  const effective = {};
  for (const [key, val] of Object.entries(changes)) {
    const current = getConfigValue(key);
    if (current !== undefined && String(current) === String(val)) continue;
    effective[key] = val;
  }
  if (Object.keys(effective).length === 0) return true;

  const signature = `${toolName}:${JSON.stringify(effective)}`;
  if (_pendingConfirmation) {
    return _pendingConfirmation.signature === signature ? _pendingConfirmation.promise : false;
  }
  let resolveFn;
  const promise = new Promise((resolve) => { resolveFn = resolve; });
  const pending = { promise, resolve: resolveFn, timer: null, messageId: null, signature };
  _pendingConfirmation = pending;
  pending.timer = setTimeout(async () => {
    if (_pendingConfirmation === pending) _pendingConfirmation = null;
    if (pending.messageId) await editMessage(CONFIRM_EXPIRED, pending.messageId).catch(() => {});
    resolveFn(false);
  }, 30_000);

  const diff = buildConfigDiff(Object.entries(effective).map(([key, val]) => ({
    key, current: getConfigValue(key), val,
  })));
  const sent = await sendMessageWithButtons(`⚠️ Update config?\n${diff}`, [[
    { text: "✅ Ya", callback_data: "confirm:yes" },
    { text: "❌ Batal", callback_data: "confirm:no" },
  ]]);
  pending.messageId = sent?.result?.message_id ?? null;
  return promise;
}

async function handleConfirmCallback(ctx, text, msg) {
  const action = text.split(":")[1];
  if (_pendingConfirmation) {
    clearTimeout(_pendingConfirmation.timer);
    const confirmed = action === "yes";
    const msgId = _pendingConfirmation.messageId;
    const resolve = _pendingConfirmation.resolve;
    _pendingConfirmation = null;
    await answerCallbackQuery(msg.callbackQueryId, confirmed ? "Confirmed" : "Cancelled");
    if (msgId) await editMessage(confirmed ? CONFIRM_OK : CONFIRM_NO, msgId).catch(() => {});
    resolve(confirmed);
  } else {
    await answerCallbackQuery(msg.callbackQueryId, "Expired");
  }
  ctx.handled = true;
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
  if (Number.isFinite(globalFeesSol) && globalFeesSol < config.screening.minTokenFeesSol) return `token fees ${globalFeesSol} SOL below minimum ${config.screening.minTokenFeesSol} SOL`;
  if (Number.isFinite(top10Pct) && top10Pct > config.screening.maxTop10Pct) return `top10 concentration ${top10Pct}% above maximum ${config.screening.maxTop10Pct}%`;
  if (Number.isFinite(botPct) && botPct > config.screening.maxBotHoldersPct) return `bot holders ${botPct}% above maximum ${config.screening.maxBotHoldersPct}%`;
  if (!hasNarrative && smartWalletCount === 0) return "only candidate has no narrative and no smart-wallet confirmation";
  return null;
}

function computeBinsBelow(volatility) {
  const parsedVolatility = Number(volatility);
  if (!Number.isFinite(parsedVolatility) || parsedVolatility <= 0) {
    throw new Error(`Invalid volatility ${volatility ?? "unknown"} — refusing volatility-scaled deploy.`);
  }
  const lo = config.strategy.minBinsBelow;
  const hi = config.strategy.maxBinsBelow;
  return Math.max(lo, Math.min(hi, Math.round(lo + (parsedVolatility / 5) * (hi - lo))));
}

async function runDeterministicScreen(limit = 5) {
  const top = await runtime.getTopCandidates({ limit });
  const candidates = (top?.candidates || top?.pools || []).slice(0, limit);
  setLatestCandidates(candidates);
  if (candidates.length > 0) return buildCandidateList(candidates);
  return buildNoCandidates({ examples: (top?.filtered_examples || []).slice(0, 5).map((e) => ({ name: e.name, reason: e.reason })) });
}

async function deployLatestCandidate(index) {
  const { candidates } = getLatestCandidatesMeta();
  const candidate = candidates[index];
  if (!candidate) throw new Error("Invalid candidate index. Run /screen first.");
  if (candidates.length === 1) {
    const mint = candidate.base?.mint || candidate.base_mint || null;
    const [smartWallets, narrative, tokenInfo] = await Promise.allSettled([
      runtime.checkSmartWalletsOnPool({ pool_address: candidate.pool }),
      mint ? runtime.getTokenNarrative({ mint }) : Promise.resolve(null),
      mint ? runtime.getTokenInfo({ query: mint }) : Promise.resolve(null),
    ]);
    const context = {
      pool: candidate,
      sw: smartWallets.status === "fulfilled" ? smartWallets.value : null,
      n: narrative.status === "fulfilled" ? narrative.value : null,
      ti: tokenInfo.status === "fulfilled" ? tokenInfo.value?.results?.[0] : null,
    };
    const skipReason = getLoneCandidateSkipReason(context);
    if (skipReason) {
      appendDecision({ type: "no_deploy", actor: "SCREENER", summary: "Single cached candidate skipped", reason: skipReason, pool: candidate.pool, pool_name: candidate.name });
      const err = new Error(`NO DEPLOY: only cached candidate ${candidate.name} is not worth deploying — ${skipReason}`);
      err.loneNoDeploy = { candidateName: candidate.name, skipReason };
      throw err;
    }
  }
  const [balForDeploy, posForDeploy] = await Promise.all([runtime.getWalletBalances(), runtime.getMyPositions({ force: true }).catch(() => ({ total_positions: 0 }))]);
  const slotsLeft = Math.max(1, config.risk.maxPositions - (posForDeploy?.total_positions ?? 0));
  const deployAmount = computeDeployAmount(balForDeploy.sol, { slotsRemaining: slotsLeft });
  if (deployAmount < minDeployAmount()) {
    throw new Error(`NO DEPLOY: modal kurang — wallet ${balForDeploy.sol.toFixed(3)} SOL tak cukup untuk satu posisi ≥ ${minDeployAmount()} SOL (gas ${config.management.gasReserve} + rent ${config.management.rentPerPositionSol}/pos).`);
  }
  const binsBelow = computeBinsBelow(candidate.volatility);
  const result = await runtime.executeTool("deploy_position", {
    pool_address: candidate.pool, amount_y: deployAmount, strategy: config.strategy.strategy,
    bins_below: binsBelow, bins_above: 0, pool_name: candidate.name,
    base_mint: candidate.base?.mint || candidate.base_mint || null,
    bin_step: candidate.bin_step, base_fee: candidate.base_fee, volatility: candidate.volatility,
    fee_tvl_ratio: candidate.fee_active_tvl_ratio ?? candidate.fee_tvl_ratio,
    organic_score: candidate.organic_score, initial_value_usd: candidate.tvl ?? candidate.active_tvl ?? null,
  });
  if (result?.success === false || result?.error) throw new Error(result.error || "Deploy failed");
  return { result, candidate, deployAmount, binsBelow };
}

export function routeIntent(text) {
  const hasCloseIntent = /\bclose\b|\bsell\b|\bexit\b|\bwithdraw\b|\btutup\b|\bjual\b|\btarik\b|\bcabut\b/i.test(text);
  const isSettingEdit = /\b(ubah|ganti|atur|setel|set|naik(?:in|kan)|turun(?:in|kan)|tingkatkan|kurangi|perbesar|perkecil|change|update|increase|decrease|lower|raise|bump|adjust)\b/i.test(text);
  const isDeployRequest = !hasCloseIntent && !isSettingEdit && /\bdeploy\b|\bopen position\b|\blp into\b|\badd liquidity\b|\bbuka posisi\b|\btambah likuiditas\b/i.test(text);
  const agentRole = isDeployRequest ? "SCREENER" : "GENERAL";
  return { hasCloseIntent, isSettingEdit, isDeployRequest, agentRole, agentModel: agentRole === "SCREENER" ? config.llm.screeningModel : config.llm.generalModel };
}

function stripThink(text) {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function handleAgentFallback(text) {
  const { agentRole, agentModel } = routeIntent(text);
  let liveMessage = null;
  try {
    liveMessage = await createLiveMessage("🤖 Live Update", `Request: ${text.slice(0, 240)}`);
    const { content } = await runtime.agentLoop(text, config.llm.maxSteps, sessionHistory, agentRole, agentModel, null, {
      interactive: true,
      onToolStart: async ({ name }) => { await liveMessage?.toolStart(name); },
      onToolFinish: async ({ name, result, success }) => { await liveMessage?.toolFinish(name, result, success); },
      onConfirmRequired: requestConfirmation,
    });
    appendHistory(text, content);
    if (liveMessage) await liveMessage.finalize(stripThink(content));
    else await sendMessage(stripThink(content));
  } catch (e) {
    if (liveMessage) await liveMessage.fail(e.message).catch(() => {});
    else await sendMessage(systemView.renderError(e.message)).catch(() => {});
  }
}

export function register(hooks) {
  hooks.on("telegram:command", async (ctx) => {
    if (ctx.handled) return;
    const text = String(ctx.text || "").trim();
    const msg = ctx.msg || { text };
    if (ctx.early) {
      if (msg?.isCallback && text.startsWith("confirm:")) await handleConfirmCallback(ctx, text, msg);
      return;
    }
    if (text === "/closeall") {
      ctx.handled = true;
      try {
        const { positions } = await runtime.getMyPositions({ force: true });
        if (!positions.length) { await sendMessage(`${ICON.position} No open positions.`); return; }
        await sendMessage(`Closing ${positions.length} position(s)...`);
        const solMode = config.management.solMode;
        const results = [];
        for (const pos of positions) {
          try {
            const result = await runtime.closePosition({ position_address: pos.position });
            results.push(result.success
              ? `${pos.pair}: ${ICON.ok} closed${result.pnl_usd != null ? ` · ${fmtMoneySigned(result.pnl_usd, solMode)}` : ""}`
              : `${pos.pair}: ${ICON.fail} failed (${result.error || "unknown"})`);
          } catch (error) { results.push(`${pos.pair}: ${ICON.fail} failed (${error.message})`); }
        }
        await sendMessage([header(ICON.closed, "Close-all", `${positions.length} posisi`), SEP, tree(results)].join("\n")).catch(() => {});
      } catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      return;
    }
    if (text === "/screen") {
      ctx.handled = true;
      try { await sendMessage(await runDeterministicScreen(5)).catch(() => {}); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      return;
    }
    if (text === "/candidates") {
      ctx.handled = true;
      await sendMessage(describeLatestCandidates(5)).catch(() => {});
      return;
    }
    const deployMatch = text.match(/^\/deploy\s+(\d+)$/i);
    if (deployMatch) {
      ctx.handled = true;
      try {
        const idx = parseInt(deployMatch[1]) - 1;
        const { candidate, result, deployAmount } = await deployLatestCandidate(idx);
        const ok = result?.success !== false && !result?.error;
        if (ok) await sendMessage(`${ICON.ok} Deploy ${candidate.name} terkirim — ${deployAmount} SOL.`).catch(() => {});
        else await sendMessage(`${ICON.fail} Deploy gagal — ${candidate.name}: ${result?.error || JSON.stringify(result)}`).catch(() => {});
      } catch (e) {
        if (e?.loneNoDeploy) await sendMessage(buildLoneNoDeploy(e.loneNoDeploy)).catch(() => {});
        else await sendMessage(systemView.renderError(e.message)).catch(() => {});
      }
      return;
    }
    if (text && !text.startsWith("/") && !msg.isCallback) {
      ctx.handled = true;
      await handleAgentFallback(text);
    }
  }, 100);
}

export const __test = {
  appendHistory, requestConfirmation, requestActionConfirmation, handleConfirmCallback,
  deployLatestCandidate, setLatestCandidates, describeLatestCandidates, sessionHistory,
  setRuntime(overrides) { Object.assign(runtime, overrides); },
  reset() { sessionHistory.length = 0; resetLatestCandidates(); _pendingConfirmation = null; },
};
