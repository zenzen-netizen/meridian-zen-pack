// Briefing/report orchestration ported from fork index.js:213-464.
// Fork bodies stay verbatim; adaptations are exports + hook transports only.
import { config, persistConfigChange } from "../config.js";
import { log } from "../logger.js";
import { getWalletBalances } from "../tools/wallet.js";
import { getGasStats } from "../gas-tracker.js";
import { getLlmCostStats } from "../llm-cost-tracker.js";
import {
  getModePerformance,
  getSuspectCount,
  getLifetimePerformance,
  getPerformanceForRacikan,
  listRacikanInPerformance,
} from "../lessons.js";
import { buildTradeReport, computeCostDragPct } from "../reports.js";
import { generateBriefing, generatePeriodicBriefing, buildMilestoneReport } from "../briefing.js";
import {
  getLastBriefingDate,
  setLastBriefingDate,
  getLastBriefingPinId,
  setLastBriefingPinId,
  getLastReportedMilestone,
  setLastReportedMilestone,
  getLastPeriodicBriefing,
  setLastPeriodicBriefing,
} from "../state.js";
import {
  sendMessage,
  sendHTML,
  isEnabled as telegramEnabled,
  pinMessage,
  unpinMessage,
  escapeHtml as escapeHtmlSafe,
} from "../telegram.js";
import { formatIdentity } from "../preset-manager.js";
import { formatPnlTracker } from "../pnl-tracker.js";
import { header, tree } from "../views/format.js";
import * as systemView from "../views/system.js";
import { racikanScopeDisclosure } from "./30-render-views.js";

export const manifest = { name: "zenpack-briefing-orch", priority: 100 };

/**
 * Send a briefing and keep only the latest one pinned: pin the new message (the
 * first chunk = top of the report), unpin the previous briefing pin, and remember
 * the new id. Pinning is best-effort — any failure (Telegram off, missing pin
 * rights) is logged and never breaks the briefing send.
 */
export async function sendAndPinBriefing(briefing) {
  const sent = await sendHTML(briefing);
  const msgId = sent?.firstMessageId ?? sent?.result?.message_id ?? null;
  if (!msgId) return sent;
  try {
    const prev = getLastBriefingPinId();
    await pinMessage(msgId);
    if (prev && prev !== msgId) await unpinMessage(prev);
    setLastBriefingPinId(msgId);
  } catch (error) {
    log("cron_error", `Briefing pin failed (continuing): ${error.message}`);
  }
  return sent;
}

/**
 * Milestone learning report: every `learningReportEvery` closed positions (10,
 * 20, 30…), fire a deep trade review once. Idempotent via a persisted milestone
 * counter so it never double-sends across restarts/cycles. Fail-open — never
 * blocks the management flow. learningReportEvery=0 disables it (/report still works).
 */
export async function maybeFireLearningReport() {
  try {
    const every = config.reports?.learningReportEvery ?? 0;
    if (!every || every < 1) return;
    const perf = getModePerformance();  // mode-scoped: paper closes milestone in dry-run, live in live
    const milestone = Math.floor(perf.length / every) * every;
    if (milestone < every) return;                       // first milestone not reached
    if (milestone <= getLastReportedMilestone()) return; // already reported this milestone
    const report = buildMilestoneReport(perf, milestone); // render diekstrak ke briefing.js (file aman)
    if (telegramEnabled() && report) await sendHTML(report);
    setLastReportedMilestone(milestone);
    log("cron", `Learning report fired at milestone ${milestone} closes`);
  } catch (error) {
    log("cron_error", `Learning report failed (fail-open): ${error.message}`);
  }
}

/**
 * Annualized cost-drag % for the quant block: recent (gas+LLM) burn scaled to a
 * year, over the liquid wallet capital. Uses the 30d window (falls back to the
 * gas estimate when no real data). Returns null on any gap. Display only.
 */
export async function computeReportCostDrag() {
  try {
    const since = Date.now() - 30 * 86400000;
    const wallet = await getWalletBalances().catch(() => null);
    const modalUsd = wallet?.total_usd || wallet?.sol_usd || null;
    if (!modalUsd) return null;
    const solPrice = wallet?.sol_price || 0;
    const gasStats = getGasStats(since);
    const gasSol = gasStats.hasData ? gasStats.sol : 0;
    const gasUsd = gasSol && solPrice ? gasSol * solPrice : 0;
    const llm = getLlmCostStats(since);
    const llmUsd = llm.hasData ? llm.totalCost : 0;
    const costUsd = gasUsd + llmUsd;
    if (costUsd <= 0) return null;
    return computeCostDragPct({ costUsd, windowDays: 30, modalUsd });
  } catch { return null; }
}

export async function buildReportForArg(arg = "") {
  const a = String(arg).trim().toLowerCase();
  if (["week", "weekly", "7d", "minggu", "mingguan"].includes(a)) return generatePeriodicBriefing("week");
  if (["month", "monthly", "30d", "bulan", "bulanan"].includes(a)) return generatePeriodicBriefing("month");
  if (["day", "today", "24h", "hari", "harian"].includes(a)) return generatePeriodicBriefing("day");
  const trendN = config.reports?.learningReportTrendN ?? 10;
  const costDragPct = await computeReportCostDrag();
  const quant = costDragPct != null ? { costDragPct } : {};

  // List racikan present in the log.
  if (["setups", "setup", "racikan", "racikans", "list"].includes(a)) {
    const rows = listRacikanInPerformance();
    if (!rows.length) return "🗂️ Belum ada racikan ber-nama di log performa (semua trade null / pra-baseline).";
    const lines = rows.map((r, i) => `${i + 1}. <b>${escapeHtmlSafe(r.name)}</b> — ${r.count} trade${r.name === config.activeSetup ? " ✅ aktif" : ""}`);
    return `🗂️ <b>Racikan di log performa</b>\nPakai <code>/report &lt;nama&gt;</code> buat blok stats penuh per racikan.\n────────────────\n${lines.join("\n")}`;
  }

  // LIFETIME tier — every live record + pre-baseline archive (mixed settings).
  if (["all", "lifetime", "semua", "seumur", "everything"].includes(a)) {
    const lifePerf = getLifetimePerformance();
    const rep = buildTradeReport(lifePerf, {
      title: "🎓 Trade Report — LIFETIME",
      subtitle: "⚠️ lifetime — termasuk pra-baseline (arsip), setting CAMPUR; bukan satu racikan",
      statsLabel: "Lifetime",
      trendN,
      identity: formatIdentity(),
      quant,
    });
    const tracker = formatPnlTracker(lifePerf);
    return tracker ? `${rep}\n\n${tracker}` : rep;
  }

  // Specific racikan tier.
  if (a) {
    const recsPerf = getPerformanceForRacikan(a);
    if (!recsPerf.length) {
      const known = listRacikanInPerformance().map((r) => r.name);
      const hint = known.length ? ` Tersedia: ${known.join(", ")}.` : "";
      return `🗂️ Racikan "<b>${escapeHtmlSafe(a)}</b>" tak punya trade tercatat.${hint}\nCoba <code>/report setups</code>, <code>/report all</code>, atau <code>/report</code> (racikan aktif).`;
    }
    const rep = buildTradeReport(recsPerf, {
      title: `🎓 Trade Report — racikan ${a}`,
      subtitle: a === (config.activeSetup || "").toLowerCase() ? "racikan AKTIF" : "racikan spesifik (non-aktif)",
      statsLabel: `Racikan ${a}`,
      trendN,
      identity: formatIdentity(),
      quant,
    });
    const tracker = formatPnlTracker(recsPerf);
    return tracker ? `${rep}\n\n${tracker}` : rep;
  }

  // Default tier — ACTIVE racikan (already racikan-isolated by getModePerformance).
  const modePerf = getModePerformance();
  const rep = buildTradeReport(modePerf, {
    title: "🎓 Trade Report — racikan aktif",
    subtitle: config.activeSetup ? `racikan: ${config.activeSetup} · pakai /report all buat lifetime` : "pakai /report all buat lifetime (incl. arsip)",
    statsLabel: "Racikan aktif",
    trendN,
    identity: formatIdentity(),
    quant,
  });
  // Surface any SUSPECT (flagged ≤−90% non-stopLoss) closes that are being held out
  // of the stats above until verified — so the operator knows they exist (hidden if 0).
  const suspectN = getSuspectCount();
  const suspectLine = suspectN > 0
    ? `\n\n⚠️ <b>Suspect (perlu verifikasi): ${suspectN}</b>\n<i>Close ≤−90% non-stopLoss — dikecualikan dari stats di atas sampai dicek (rug asli vs bad-data).</i>`
    : "";
  const tracker = formatPnlTracker(modePerf);
  return `${rep}${tracker ? `\n\n${tracker}` : ""}${suspectLine}${racikanScopeDisclosure()}`;
}

/**
 * Scheduled weekly/monthly digest. Deduped by period key (the week's Monday date
 * or "YYYY-MM") so a restart near the cron tick won't re-send. Pinned like the
 * daily briefing (latest digest stays pinned). Fail-open.
 */
export async function runPeriodicBriefing(period) {
  try {
    const now = new Date();
    let key;
    if (period === "month") {
      key = now.toISOString().slice(0, 7); // YYYY-MM
    } else {
      const d = new Date(now); const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
      d.setUTCDate(d.getUTCDate() - dow);
      key = d.toISOString().slice(0, 10); // this week's Monday (UTC)
    }
    if (getLastPeriodicBriefing(period) === key) return; // already sent this period
    log("cron", `Starting ${period} briefing (${key})`);
    const html = await generatePeriodicBriefing(period);
    if (telegramEnabled()) await sendAndPinBriefing(html);
    setLastPeriodicBriefing(period, key);
  } catch (error) {
    log("cron_error", `${period} briefing failed: ${error.message}`);
  }
}

/**
 * gasReserve auto-tune (default OFF). When on, right-sizes gasReserve from REAL
 * measured gas burn: keep `gasReserveBufferDays` of runway, never below
 * `gasReserveFloorSol`. Only adjusts on a meaningful change (>20% and >0.005 SOL)
 * to avoid churn. Needs ≥8 real gas records. Fail-open. OFF = gasReserve untouched.
 */
export async function maybeAutoTuneGasReserve() {
  try {
    if (!config.management?.gasReserveAutoTune) return;
    const sinceMs = Date.now() - 7 * 86400000;
    const stats = getGasStats(sinceMs);
    if (!stats.hasData || stats.count < 8) return;
    const firstMs = Math.max(sinceMs, new Date(stats.firstTs).getTime());
    const spanDays = Math.min(7, Math.max(1, (Date.now() - firstMs) / 86400000));
    const dailyBurn = stats.sol / spanDays;
    if (dailyBurn <= 0) return;
    const buffer = config.management.gasReserveBufferDays ?? 14;
    const floor = config.management.gasReserveFloorSol ?? 0.03;
    const target = parseFloat(Math.max(floor, dailyBurn * buffer).toFixed(3));
    const current = config.management.gasReserve;
    if (Math.abs(target - current) / Math.max(current, 0.001) < 0.2 || Math.abs(target - current) < 0.005) return;
    persistConfigChange("management", "gasReserve", "gasReserve", target);
    log("cron", `gasReserve auto-tuned ${current} → ${target} SOL (burn ${dailyBurn.toFixed(5)}/d × ${buffer}d, floor ${floor})`);
    if (telegramEnabled()) sendMessage([
      header("🪫", "gasReserve auto-tuned"),
      tree([
        `${current} → ${target} SOL`,
        `≈${buffer}d runway @ ${dailyBurn.toFixed(5)} SOL/hari (dari gas nyata)`,
      ]),
    ].join("\n")).catch(() => {});
  } catch (error) {
    log("cron_error", `gasReserve auto-tune failed (fail-open): ${error.message}`);
  }
}

export async function runBriefing() {
  log("cron", "Starting morning briefing");
  await maybeAutoTuneGasReserve(); // daily, before composing the briefing
  try {
    const briefing = await generateBriefing();
    if (telegramEnabled()) {
      await sendAndPinBriefing(briefing);
    }
    setLastBriefingDate();
  } catch (error) {
    log("cron_error", `Morning briefing failed: ${error.message}`);
  }
}

export async function maybeRunMissedBriefing() {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const lastSent = getLastBriefingDate();

  if (lastSent === todayUtc) return; // already sent today

  // Only fire if it's past the scheduled time (1:00 AM UTC)
  const nowUtc = new Date();
  const briefingHourUtc = 1;
  if (nowUtc.getUTCHours() < briefingHourUtc) return; // too early, cron will handle it

  log("cron", `Missed briefing detected (last sent: ${lastSent || "never"}) — sending now`);
  await runBriefing();
}

function plain(text) {
  return String(text).replace(/<[^>]*>/g, "");
}

async function handleCommand(ctx) {
  const text = String(ctx.text || "");
  const repl = ctx.channel === "repl";
  if (text === "/briefing" || text === "/briefing alltime") {
    try {
      const briefing = await generateBriefing({ allTimeDeep: text === "/briefing alltime" });
      if (repl) await ctx.reply(plain(briefing));
      else await sendAndPinBriefing(briefing);
    } catch (e) {
      await ctx.reply(systemView.renderError(e.message));
    }
    ctx.handled = true;
    return;
  }
  if (text === "/report" || text.startsWith("/report ")) {
    try {
      const report = await buildReportForArg(text.slice("/report".length));
      if (repl) await ctx.reply(plain(report));
      else await sendHTML(report);
    } catch (e) {
      await ctx.reply(systemView.renderError(e.message));
    }
    ctx.handled = true;
  }
}

export function register(hooks) {
  hooks.on("telegram:command", handleCommand, 100);
  hooks.on("repl:command", handleCommand, 100);
  hooks.on("briefing:run", async (ctx) => {
    await runBriefing();
    ctx.handled = true;
  }, 100);
  hooks.on("briefing:periodic", async (ctx) => {
    await runPeriodicBriefing(ctx.period);
    ctx.handled = true;
  }, 100);
  hooks.on("management:afterCycle", async () => {
    await maybeFireLearningReport();
  }, 100);
}
