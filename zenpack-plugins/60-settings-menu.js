// Plugin 60: /settings interactive menu pages (Stage 7.2).
//
// Ports fork index.js settings display/menu machine into plugin space so vanilla
// index.js settings helpers remain a dead path while this plugin handles:
//   /settings, /menu, /configmenu
//   cfg:* callback_query
//   pending text input for cfg:input / preset save
//
// Adaptasi minimal owner-locked:
// - GMGN update_config split persistence is not ported yet. All gmgn* menu edit
//   actions are gated here with a toast/message and never call executeTool.
//   Recovery path: remove this gate when update_config block 1 lands.
// - requestActionConfirmation/requestConfirmation stay out of scope 7.2.
// - buildConfigRowMap/formatFullConfig are reused from plugin 30 to avoid
//   duplicating the same display helper already ported there.
import { config } from "../config.js";
import { executeTool } from "../tools/executor.js";
import {
  sendMessageWithButtons,
  editMessageWithButtons,
  answerCallbackQuery,
  sendMessage,
  editMessage,
} from "../telegram.js";
import {
  initSettingsViews,
  renderSettingsMenu,
  settingValue,
  settingButton,
  fmtSettingValue,
  categoryButton,
  cycleControl,
} from "../views/settings.js";
import * as systemView from "../views/system.js";
import { ICON } from "../views/format.js";
import {
  ORIGIN_SECTIONS,
  FUNCTION_GROUPS,
  ORIGIN_NOTES,
  KEY_SUBCLUSTER,
  SUB_CLUSTER_META,
  L4_CHILDREN,
} from "../config-origin.js";
import {
  savePreset,
  applyPreset,
  getPresetDiff,
  deletePreset,
  validName,
  presetExists,
} from "../preset-manager.js";
import { buildConfigRowMap, formatFullConfig } from "./30-render-views.js";

export const manifest = { name: "zenpack-settings-menu", priority: 100 };

let _pendingInput = null; // { key, page, menuMsgId } or { action:"presetSave", menuMsgId }
let _settingsView = "main";

const GMGN_GATE_TEXT = "⏳ setelan gmgn belum aktif (menunggu port update_config blok 1)";
const isGmgnKey = (key) => String(key || "").toLowerCase().startsWith("gmgn");

// Render one subgroup's rows: fork index.js:1960-1990.
function renderSubclusterRows(keys, rowMap) {
  const note = (k) => (ORIGIN_NOTES[k] ? ` ${ORIGIN_NOTES[k]}` : "");
  const dash = "┈┈┈┈┈┈┈┈┈┈";
  const order = [];
  const members = {};
  for (const k of keys) {
    if (!rowMap[k]) continue;
    const cl = KEY_SUBCLUSTER[k] || "_misc";
    if (!members[cl]) { members[cl] = []; order.push(cl); }
    members[cl].push(k);
  }
  const showL3 = order.length > 1;
  const out = [];
  const placed = [];
  for (const cl of order) {
    const meta = SUB_CLUSTER_META[cl];
    if (showL3 && meta) {
      out.push(`  ${meta.emoji} ${meta.label}`);
      out.push(`  ${dash}`);
    }
    for (const k of members[cl]) {
      placed.push(k);
      const [label, value] = rowMap[k];
      const indent = L4_CHILDREN.has(k) ? "      ↳ " : "    ";
      out.push(`${indent}${label}: ${value}${note(k)}`);
    }
  }
  return { text: out.join("\n"), placed };
}

// Dynamic per-subgroup description: fork index.js:1991-2031.
function subgroupDesc(sg) {
  if (sg.id !== "zen-gmgn") return sg.desc;
  return String(config.screening.source).toLowerCase() === "gmgn"
    ? "Pipeline screening GMGN AKTIF (source=gmgn)."
    : `Pipeline screening GMGN tidak aktif (source=${config.screening.source}, blok ini diabaikan).`;
}

// parseConfigValue/getConfigValue: fork index.js:2049-2075.
function parseConfigValue(raw) {
  const value = String(raw ?? "").trim();
  if (!value.length) return "";
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^null$/i.test(value)) return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) {
    return JSON.parse(value);
  }
  return value;
}

function getConfigValue(key) {
  const known = settingValue(key);
  if (known !== undefined) return known;
  for (const section of Object.values(config)) {
    if (section && typeof section === "object" && key in section) return section[key];
  }
  return undefined;
}

// Called after a successful preset load. Same adaptation as plugin 10.
function underPm2() {
  return process.env.pm_id !== undefined || !!process.env.PM2_HOME || !!process.env.PM2_USAGE;
}

async function finishPresetApply({ viaTelegram }) {
  const note = underPm2()
    ? "♻️ Auto-restart via pm2 dalam 2 detik untuk apply penuh (DRY_RUN/wallet/model dibaca saat start)…"
    : "♻️ Restart proses untuk apply penuh (mis. `pm2 restart meridian`). Restart cron saja tidak cukup — DRY_RUN/wallet/RPC/model dibaca saat start.";
  if (viaTelegram) await sendMessage(note).catch(() => {});
  else console.log(note);
  if (underPm2()) setTimeout(() => process.exit(0), 2000);
}

const MENU_CONTROLS = {
  // ⚙️ dev-screening
  timeframe: cycleControl("timeframe", "Timeframe", ["5m", "30m", "1h", "2h", "4h", "12h", "24h"], 4),
  category: cycleControl("category", "Category", ["trending", "top", "new"]),
  minTvl: { input: ["minTvl", "Min TVL"] },
  maxTvl: { input: ["maxTvl", "Max TVL"] },
  minVolume: { input: ["minVolume", "Min volume"] },
  minMcap: { input: ["minMcap", "Min mcap"] },
  maxMcap: { input: ["maxMcap", "Max mcap"] },
  minHolders: { input: ["minHolders", "Min holders"] },
  minFeeActiveTvlRatio: { input: ["minFeeActiveTvlRatio", "Min fee/aTVL", { digits: 3 }] },
  minTokenFeesSol: { input: ["minTokenFeesSol", "Min token fees SOL"] },
  minOrganic: { input: ["minOrganic", "Min organic"] },
  minQuoteOrganic: { input: ["minQuoteOrganic", "Min quote organic"] },
  minTokenAgeHours: { input: ["minTokenAgeHours", "Min age (h)"] },
  maxTokenAgeHours: { input: ["maxTokenAgeHours", "Max age (h)"] },
  minBinStep: { input: ["minBinStep", "Min bin-step"] },
  maxBinStep: { input: ["maxBinStep", "Max bin-step"] },
  excludeHighSupplyConcentration: { toggle: ["excludeHighSupplyConcentration", "Excl. high supply conc."] },
  maxBotHoldersPct: { input: ["maxBotHoldersPct", "Max bot holders %"] },
  maxTop10Pct: { input: ["maxTop10Pct", "Max top10 %"] },
  avoidPvpSymbols: { toggle: ["avoidPvpSymbols", "Avoid PVP symbols"] },
  blockPvpSymbols: { toggle: ["blockPvpSymbols", "PVP hard block"] },
  useDiscordSignals: { toggle: ["useDiscordSignals", "Discord signals"] },
  discordSignalMode: cycleControl("discordSignalMode", "Discord mode", ["merge", "only"]),
  // ⚙️ dev-management
  solMode: { toggle: ["solMode", "SOL mode"] },
  maxPositions: { input: ["maxPositions", "Max positions"] },
  maxDeployAmount: { input: ["maxDeployAmount", "Max SOL"] },
  deployAmountSol: { input: ["deployAmountSol", "Deploy SOL", { digits: 2 }] },
  positionSizePct: { input: ["positionSizePct", "Position size %", { digits: 2 }] },
  minSolToOpen: { input: ["minSolToOpen", "Min SOL to open", { digits: 2 }] },
  gasReserve: { input: ["gasReserve", "Gas reserve", { digits: 2 }] },
  stopLossPct: { input: ["stopLossPct", "SL %"] },
  takeProfitPct: { input: ["takeProfitPct", "TP %"] },
  trailingTakeProfit: { toggle: ["trailingTakeProfit", "Trailing TP"] },
  trailingTriggerPct: { input: ["trailingTriggerPct", "Trail trigger", { digits: 1 }] },
  trailingDropPct: { input: ["trailingDropPct", "Trail drop", { digits: 1 }] },
  outOfRangeBinsToClose: { input: ["outOfRangeBinsToClose", "OOR bins to close"] },
  outOfRangeWaitMinutes: { input: ["outOfRangeWaitMinutes", "OOR wait (min)"] },
  oorCooldownTriggerCount: { input: ["oorCooldownTriggerCount", "OOR cooldown count"] },
  oorCooldownHours: { input: ["oorCooldownHours", "OOR cooldown hrs"] },
  repeatDeployCooldownEnabled: { toggle: ["repeatDeployCooldownEnabled", "Repeat cooldown"] },
  repeatDeployCooldownTriggerCount: { input: ["repeatDeployCooldownTriggerCount", "Repeat count"] },
  repeatDeployCooldownHours: { input: ["repeatDeployCooldownHours", "Repeat hrs"] },
  repeatDeployCooldownScope: cycleControl("repeatDeployCooldownScope", "Repeat scope", ["pool", "token", "both"]),
  repeatDeployCooldownMinFeeEarnedPct: { input: ["repeatDeployCooldownMinFeeEarnedPct", "Min fee earned %", { digits: 1 }] },
  minFeePerTvl24h: { input: ["minFeePerTvl24h", "Min fee/TVL 24h"] },
  minAgeBeforeYieldCheck: { input: ["minAgeBeforeYieldCheck", "Min age before yield (min)"] },
  minVolumeToRebalance: { input: ["minVolumeToRebalance", "Min vol to rebalance"] },
  minClaimAmount: { input: ["minClaimAmount", "Min claim amount"] },
  autoSwapAfterClaim: { toggle: ["autoSwapAfterClaim", "Auto-swap after claim"] },
  // ⚙️ dev-strategy
  strategy: {
    pageKeys: ["strategy"],
    build: () => [[
      settingButton("spot", "cfg:set:strategy:spot"),
      settingButton("bid_ask", "cfg:set:strategy:bid_ask"),
    ]],
  },
  minBinsBelow: { input: ["minBinsBelow", "Min bins"] },
  maxBinsBelow: { input: ["maxBinsBelow", "Max bins"] },
  defaultBinsBelow: { input: ["defaultBinsBelow", "Default bins"] },
  // ⚙️ dev-schedule
  managementIntervalMin: { input: ["managementIntervalMin", "Manage interval (min)"] },
  screeningIntervalMin: { input: ["screeningIntervalMin", "Screen interval — floor (min)"] },
  healthCheckIntervalMin: { input: ["healthCheckIntervalMin", "Health-check (min)"] },
  // ⚙️ dev-llm — models are free-form strings (provider/slug); the menu's input
  // field is numeric-only, so models stay 👁 (edit via /setcfg). Numeric params here.
  temperature: { input: ["temperature", "Temperature", { digits: 3 }] },
  maxTokens: { input: ["maxTokens", "Max tokens"] },
  maxSteps: { input: ["maxSteps", "Max steps"] },
  // ⚙️ dev-indicators
  enabled: { toggle: ["chartIndicatorsEnabled", "Chart indicators"] },
  entryPreset: {
    pageKeys: ["indicatorEntryPreset"],
    build: () => [
      [
        settingButton("Entry: ST", "cfg:set:indicatorEntryPreset:supertrend_break"),
        settingButton("Entry: RSI", "cfg:set:indicatorEntryPreset:rsi_reversal"),
        settingButton("Entry: ST/RSI", "cfg:set:indicatorEntryPreset:supertrend_or_rsi"),
      ],
      [settingButton("Entry: ST+SMI", "cfg:set:indicatorEntryPreset:supertrend_plus_smi")],
    ],
  },
  exitPreset: {
    pageKeys: ["indicatorExitPreset"],
    build: () => [[
      settingButton("Exit: ST", "cfg:set:indicatorExitPreset:supertrend_break"),
      settingButton("Exit: RSI", "cfg:set:indicatorExitPreset:rsi_reversal"),
      settingButton("Exit: BB+RSI", "cfg:set:indicatorExitPreset:bb_plus_rsi"),
    ]],
  },
  rsiLength: { input: ["rsiLength", "RSI length"] },
  rsiOversold: { input: ["rsiOversold", "RSI oversold"] },
  rsiOverbought: { input: ["rsiOverbought", "RSI overbought"] },
  candles: { input: ["indicatorCandles", "Candles"] },
  intervals: {
    pageKeys: ["indicatorIntervals"],
    build: () => [[
      settingButton("TF: 5m", "cfg:set:indicatorIntervals:5_MINUTE"),
      settingButton("TF: 15m", "cfg:set:indicatorIntervals:15_MINUTE"),
      settingButton("TF: both", "cfg:set:indicatorIntervals:both"),
    ]],
  },
  requireAllIntervals: { toggle: ["requireAllIntervals", "Require all TF"] },
  // ⚙️ dev-infra
  lpAgentRelayEnabled: { toggle: ["lpAgentRelayEnabled", "LPAgent relay"] },
  hiveMindPullMode: cycleControl("hiveMindPullMode", "Hive pull mode", ["auto", "manual"]),
  pnlDepositCacheTtlSec: { input: ["pnlDepositCacheTtlSec", "PnL deposit cache (s)"] },
  pnlSanityMaxDiffPct: { input: ["pnlSanityMaxDiffPct", "PnL sanity max diff %"] },
  pnlSource: {
    pageKeys: ["pnlSource"],
    build: () => [[
      settingButton(`PnL src: ${fmtSettingValue(settingValue("pnlSource"))}`, "cfg:noop"),
      settingButton("rpc", "cfg:set:pnlSource:rpc"),
      settingButton("meteora", "cfg:set:pnlSource:meteora"),
    ]],
  },
  pnlPollIntervalSec: { input: ["pnlPollIntervalSec", "PnL poll (sec)"] },
  gmgnFeeSource: {
    pageKeys: ["gmgnFeeSource"],
    build: () => [[
      settingButton(`Fee src: ${fmtSettingValue(settingValue("gmgnFeeSource"))}`, "cfg:noop"),
      settingButton("gmgn", "cfg:set:gmgnFeeSource:gmgn"),
      settingButton("jupiter", "cfg:set:gmgnFeeSource:jupiter"),
    ]],
  },
  // 🧩 zen-screening
  screeningSource: {
    pageKeys: ["screeningSource"],
    build: () => [[
      settingButton("Source: Meteora", "cfg:set:screeningSource:meteora"),
      settingButton("Source: GMGN", "cfg:set:screeningSource:gmgn"),
    ]],
  },
  screeningCategories: {
    pageKeys: ["screeningCategories"],
    build: () => [[categoryButton("trending"), categoryButton("top"), categoryButton("new")]],
  },
  // 🧩 zen-gmgn
  "gmgn.interval": {
    pageKeys: ["gmgnInterval"],
    build: () => [[
      settingButton("5m", "cfg:set:gmgnInterval:5m"),
      settingButton("1h", "cfg:set:gmgnInterval:1h"),
      settingButton("6h", "cfg:set:gmgnInterval:6h"),
      settingButton("24h", "cfg:set:gmgnInterval:24h"),
    ]],
  },
  "gmgn.minMcap": { input: ["gmgnMinMcap", "Min mcap"] },
  "gmgn.maxMcap": { input: ["gmgnMaxMcap", "Max mcap"] },
  "gmgn.minVolume": { input: ["gmgnMinVolume", "Min volume"] },
  "gmgn.minHolders": { input: ["gmgnMinHolders", "Min holders"] },
  "gmgn.minTokenAgeHours": { input: ["gmgnMinTokenAgeHours", "Min token age (h)"] },
  "gmgn.maxTokenAgeHours": { input: ["gmgnMaxTokenAgeHours", "Max token age (h)"] },
  "gmgn.athFilterPct": { input: ["gmgnAthFilterPct", "ATH filter %"] },
  "gmgn.minTotalFeeSol": { input: ["gmgnMinTotalFeeSol", "Min fee SOL"] },
  "gmgn.requireKol": { toggle: ["gmgnRequireKol", "Require KOL"] },
  "gmgn.minKolCount": { input: ["gmgnMinKolCount", "Min KOL"] },
  "gmgn.minSmartDegenCount": { input: ["gmgnMinSmartDegenCount", "Min smart degen"] },
  "gmgn.maxBundlerRate": { input: ["gmgnMaxBundlerRate", "Max bundler %", { digits: 2 }] },
  "gmgn.maxRatTraderRate": { input: ["gmgnMaxRatTraderRate", "Max rat trader", { digits: 2 }] },
  "gmgn.maxFreshWalletRate": { input: ["gmgnMaxFreshWalletRate", "Max fresh wallet", { digits: 2 }] },
  "gmgn.maxDevTeamHoldRate": { input: ["gmgnMaxDevTeamHoldRate", "Max dev hold", { digits: 2 }] },
  "gmgn.maxBotDegenRate": { input: ["gmgnMaxBotDegenRate", "Max bot degen", { digits: 2 }] },
  "gmgn.maxSniperCount": { input: ["gmgnMaxSniperCount", "Max sniper count"] },
  "gmgn.maxSniperHoldRate": { input: ["gmgnMaxSniperHoldRate", "Max sniper hold", { digits: 2 }] },
  "gmgn.preferredKolNames": { input: ["gmgnPreferredKolNames", "Preferred KOL (comma-sep)"] },
  "gmgn.preferredKolMinHoldPct": { input: ["gmgnPreferredKolMinHoldPct", "Preferred KOL min hold %"] },
  "gmgn.dumpKolNames": { input: ["gmgnDumpKolNames", "Dump KOL (comma-sep)"] },
  "gmgn.dumpKolMinHoldPct": { input: ["gmgnDumpKolMinHoldPct", "Dump KOL min hold %"] },
  "gmgn.indicatorFilter": { toggle: ["gmgnIndicatorFilter", "Indicator filter"] },
  "gmgn.indicatorInterval": {
    pageKeys: ["gmgnIndicatorInterval"],
    build: () => [[
      settingButton("TF: 5m", "cfg:set:gmgnIndicatorInterval:5_MINUTE"),
      settingButton("TF: 15m", "cfg:set:gmgnIndicatorInterval:15_MINUTE"),
      settingButton("TF: 1h", "cfg:set:gmgnIndicatorInterval:1h"),
    ]],
  },
  "gmgn.rules.requireBullishSupertrend": { toggle: ["gmgnRequireBullishSt", "Bullish ST"] },
  "gmgn.rules.rejectAlreadyAtBottom": { toggle: ["gmgnRejectAtBottom", "Reject at bottom"] },
  "gmgn.rules.requireAboveSupertrend": { toggle: ["gmgnRequireAboveSt", "Above ST"] },
  "gmgn.rules.minRsi": { input: ["gmgnMinRsi", "Min RSI"] },
  "gmgn.rules.maxRsi": { input: ["gmgnMaxRsi", "Max RSI"] },
  // 🧩 zen-management
  sizingMode: cycleControl("sizingMode", "Sizing mode", ["fixed", "maximize"], 2),
  rentPerPositionSol: { input: ["rentPerPositionSol", "Rent/posisi SOL", { digits: 3 }] },
  gasReserveAutoTune: { toggle: ["gasReserveAutoTune", "Gas reserve auto-tune"] },
  gasReserveBufferDays: { input: ["gasReserveBufferDays", "Gas buffer days"] },
  gasReserveFloorSol: { input: ["gasReserveFloorSol", "Gas reserve floor SOL", { digits: 2 }] },
  // 🧩 zen-strategy
  strategyLock: {
    pageKeys: ["strategyLock"],
    build: () => [
      [settingButton(`🔒 lock: ${fmtSettingValue(settingValue("strategyLock") ?? "default")}`, "cfg:noop")],
      [
        settingButton("default", "cfg:set:strategyLock:default"),
        settingButton("lock spot", "cfg:set:strategyLock:spot"),
        settingButton("lock bid_ask", "cfg:set:strategyLock:bid_ask"),
      ],
    ],
  },
  // 🧩 zen-schedule
  adaptiveScreening: { toggle: ["adaptiveScreening", "Adaptive screening"] },
  maxScreeningIntervalMin: { input: ["maxScreeningIntervalMin", "Screen interval — ceil (min)"] },
  // 🧩 zen-llm
  generalMaxTokens: { input: ["generalMaxTokens", "General max tokens"] },
  // 🧩 zen-indicators
  exitEnabled: { toggle: ["indicatorExitEnabled", "Exit triggers close"] },
  rejectAlreadyAtBottom: { toggle: ["indicatorRejectAtBottom", "Reject @ bottom"] },
  smiPdLookback: { input: ["smiPdLookback", "SMI PD lookback"] },
  smiPaLookback: { input: ["smiPaLookback", "SMI PA lookback"] },
  smiCrossWindow: { input: ["smiCrossWindow", "SMI cross window"] },
  // 🧩 zen-reports
  learningReportEvery: { input: ["learningReportEvery", "Learning report every N (0=off)"] },
  learningReportTrendN: { input: ["learningReportTrendN", "Trend window N"] },
  // 🧬 zen-learning
  evolveEnabled: { toggle: ["evolveEnabled", "Auto-evolve threshold (off=FREEZE)"] },
  // 🧪 zen-experiments
  candidateMomentum: { toggle: ["candidateMomentum", "Candidate momentum"] },
  smartWalletMomentum: { toggle: ["smartWalletMomentum", "Smart-wallet mom."] },
  expectedYieldSignal: { toggle: ["expectedYieldSignal", "Expected yield"] },
  narrativeProfileSignal: { toggle: ["narrativeProfileSignal", "Narrative profile"] },
  counterfactualReview: { toggle: ["counterfactualReview", "Counterfactual review"] },
  counterfactualMinMcapGainPct: { input: ["counterfactualMinMcapGainPct", "Counterfactual min mcap gain %"] },
  exitLiquidityCheck: { toggle: ["exitLiquidityCheck", "Exit-liquidity GATE"] },
  exitLiquidityMaxSlippagePct: { input: ["exitLiquidityMaxSlippagePct", "Exit max slippage %", { digits: 1 }] },
  marketRegimeGate: { toggle: ["marketRegimeGate", "Market-regime GATE"] },
  marketRegimeMaxDrop24hPct: { input: ["marketRegimeMaxDrop24hPct", "Regime max SOL drop 24h %", { digits: 1 }] },
  convictionSizing: { toggle: ["convictionSizing", "Conviction sizing (moves capital)"] },
  convictionSizingMaxAdjustPct: { input: ["convictionSizingMaxAdjustPct", "Conviction max adjust %"] },
  idleScreeningCooldown: { toggle: ["idleScreeningCooldown", "Idle screening cooldown"] },
  idleScreeningCooldownMin: { input: ["idleScreeningCooldownMin", "Idle cooldown minutes"] },
  paperTrading: { toggle: ["paperTrading", "Paper trading (DRY-RUN sim)"] },
  usePaperHistoryWhenLive: { toggle: ["usePaperHistoryWhenLive", "Use paper history when live"] },
};

const MENU_KEY_TO_PAGE = (() => {
  const m = {};
  for (const sec of ORIGIN_SECTIONS) {
    for (const sg of sec.subgroups) {
      for (const k of sg.keys) {
        const ctrl = MENU_CONTROLS[k];
        if (!ctrl) continue;
        const keys = ctrl.pageKeys || (ctrl.toggle ? [ctrl.toggle[0]] : ctrl.input ? [ctrl.input[0]] : []);
        for (const sk of keys) m[sk] = sg.id;
      }
    }
  }
  return m;
})();

const MENU_KEY_TO_FNGROUP = (() => {
  const m = {};
  for (const fg of FUNCTION_GROUPS) {
    for (const k of fg.keys) {
      const ctrl = MENU_CONTROLS[k];
      if (!ctrl) continue;
      const keys = ctrl.pageKeys || (ctrl.toggle ? [ctrl.toggle[0]] : ctrl.input ? [ctrl.input[0]] : []);
      for (const sk of keys) m[sk] = fg.id;
    }
  }
  return m;
})();

function pageForKey(key) {
  return MENU_KEY_TO_PAGE[key] || "dev-management";
}

function returnTokenForKey(key) {
  const [curBase, curPage] = String(_settingsView).split("~");
  if (curBase === "fn-landing" || curBase.startsWith("fn-")) {
    const fid = `fn-${MENU_KEY_TO_FNGROUP[key] || "sizing"}`;
    return curBase === fid && curPage ? `${fid}~${curPage}` : fid;
  }
  const gid = pageForKey(key);
  return curBase === gid && curPage ? `${gid}~${curPage}` : gid;
}

async function showSettingsMenu({ messageId = null, page = "fn-landing" } = {}) {
  _settingsView = page;
  const menu = renderSettingsMenu(page);
  if (messageId) {
    await editMessageWithButtons(menu.text, messageId, menu.keyboard);
  } else {
    await sendMessageWithButtons(menu.text, menu.keyboard);
  }
}

function normalizeMenuValue(key, raw) {
  if (key === "indicatorIntervals") {
    if (raw === "both") return ["5_MINUTE", "15_MINUTE"];
    return [raw];
  }
  if (key === "gmgnPreferredKolNames" || key === "gmgnDumpKolNames") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return parseConfigValue(raw);
}

async function gateGmgnCallback(msg) {
  await answerCallbackQuery(msg.callbackQueryId, GMGN_GATE_TEXT);
}

async function applySettingsMenuCallback(msg) {
  const data = msg.callbackData || msg.text || "";
  const parts = data.split(":");
  const action = parts[1];
  let page = "main";

  if (action === "noop") {
    await answerCallbackQuery(msg.callbackQueryId);
    return;
  }
  if (action === "input") {
    const inputKey = parts[2];
    if (isGmgnKey(inputKey)) {
      await gateGmgnCallback(msg);
      return;
    }
    const currentVal = settingValue(inputKey);
    const inputPage = returnTokenForKey(inputKey);
    _pendingInput = { key: inputKey, page: inputPage, menuMsgId: msg.messageId };
    await answerCallbackQuery(msg.callbackQueryId);
    await sendMessage(`Enter new value for ${inputKey} (current: ${currentVal ?? "off"}):\nSend a number, or "off" to clear.`);
    return;
  }
  if (action === "close") {
    await answerCallbackQuery(msg.callbackQueryId, "Closed");
    await editMessage("Settings menu closed.", msg.messageId);
    return;
  }
  if (action === "show") {
    await answerCallbackQuery(msg.callbackQueryId);
    await sendMessage(formatFullConfig());
    return;
  }
  if (action === "page") {
    page = parts[2] || "main";
    await answerCallbackQuery(msg.callbackQueryId);
    await showSettingsMenu({ messageId: msg.messageId, page });
    return;
  }
  if (action === "preset") {
    const sub = parts[2];
    const name = parts.slice(3).join(":");
    if (sub === "save") {
      _pendingInput = { action: "presetSave", menuMsgId: msg.messageId };
      await answerCallbackQuery(msg.callbackQueryId);
      await sendMessage("💾 Ketik nama preset untuk menyimpan config sekarang (huruf/angka/_/-, maks 40):");
      return;
    }
    if (!presetExists(name)) {
      await answerCallbackQuery(msg.callbackQueryId, "Preset tidak ada");
      await showSettingsMenu({ messageId: msg.messageId, page: "presets" });
      return;
    }
    if (sub === "diff") {
      const diffs = getPresetDiff(name);
      await answerCallbackQuery(msg.callbackQueryId);
      const shown = diffs.length
        ? diffs.slice(0, 30).map((d) => `${d.key}: ${d.from} → ${d.to}`)
        : ["(identik dengan config sekarang)"];
      const more = diffs.length > 30 ? `\n…+${diffs.length - 30} lagi` : "";
      await editMessageWithButtons(
        `🔍 "${name}" vs config sekarang (${diffs.length} beda):\n${shown.join("\n")}${more}`,
        msg.messageId,
        [[settingButton(`✅ Load "${name}"`, `cfg:preset:ask:${name}`)], [settingButton("Back", "cfg:page:presets")]],
      );
      return;
    }
    if (sub === "rmask") {
      await answerCallbackQuery(msg.callbackQueryId);
      await editMessageWithButtons(
        `🗑️ Hapus preset "${name}"? Permanen (file dihapus, config live tidak terpengaruh).`,
        msg.messageId,
        [[settingButton(`🗑️ Ya, hapus "${name}"`, `cfg:preset:rmgo:${name}`)], [settingButton("Batal", "cfg:page:presets")]],
      );
      return;
    }
    if (sub === "rmgo") {
      deletePreset(name);
      await answerCallbackQuery(msg.callbackQueryId, `Dihapus: ${name}`);
      await showSettingsMenu({ messageId: msg.messageId, page: "presets" });
      return;
    }
    if (sub === "ask") {
      const diffs = getPresetDiff(name);
      await answerCallbackQuery(msg.callbackQueryId);
      const body = [
        `⚠️ Load preset "${name}"?`,
        diffs.length ? `${diffs.length} setting berubah vs config sekarang.` : "Config sudah sama — tidak ada yang berubah.",
        "Config sekarang di-backup (rollback via _backup), lalu bot RESTART untuk apply penuh.",
      ].join("\n");
      await editMessageWithButtons(body, msg.messageId, [
        [settingButton(`✅ Load "${name}" & restart`, `cfg:preset:go:${name}`)],
        [settingButton("Batal", "cfg:page:presets")],
      ]);
      return;
    }
    if (sub === "go") {
      const diffs = getPresetDiff(name);
      const r = applyPreset(name);
      await answerCallbackQuery(msg.callbackQueryId, `Loaded ${name}`);
      await editMessage(`✅ Preset "${name}" di-load (${diffs.length} setting berubah). Rollback: /preset use ${r.backup}`, msg.messageId);
      await finishPresetApply({ viaTelegram: true });
      return;
    }
    await answerCallbackQuery(msg.callbackQueryId, "Aksi preset tidak dikenal");
    return;
  }

  if (action === "cat") {
    const cat = parts[2];
    const cur = Array.isArray(config.screening.categories) ? config.screening.categories.slice() : [];
    const idx = cur.indexOf(cat);
    if (idx >= 0) cur.splice(idx, 1);
    else cur.push(cat);
    const value = cur.length ? cur : null;
    const result = await executeTool("update_config", {
      changes: { screeningCategories: value },
      reason: "Telegram settings menu",
    });
    if (!result?.success) {
      await answerCallbackQuery(msg.callbackQueryId, "Config update failed");
      return;
    }
    await answerCallbackQuery(msg.callbackQueryId, `categories: ${value ? value.join(",") : "off (factory)"}`);
    await showSettingsMenu({ messageId: msg.messageId, page: returnTokenForKey("screeningCategories") });
    return;
  }

  const key = parts[2];
  if (isGmgnKey(key)) {
    await gateGmgnCallback(msg);
    return;
  }
  let value;
  if (action === "toggle") {
    value = !Boolean(settingValue(key));
  } else if (action === "step") {
    const current = Number(settingValue(key));
    const delta = Number(parts[3]);
    if (!Number.isFinite(current) || !Number.isFinite(delta)) {
      await answerCallbackQuery(msg.callbackQueryId, "Invalid setting");
      return;
    }
    value = Number((current + delta).toFixed(4));
    if (key === "maxPositions") value = Math.max(1, Math.round(value));
    if (key === "rsiLength") value = Math.max(2, Math.round(value));
    if (key === "repeatDeployCooldownTriggerCount") value = Math.max(1, Math.round(value));
    if (key === "repeatDeployCooldownHours") value = Math.max(0, Math.round(value));
    if (key === "repeatDeployCooldownMinFeeEarnedPct") value = Math.max(0, value);
    if (["deployAmountSol", "gasReserve", "maxDeployAmount"].includes(key)) value = Math.max(0, value);
  } else if (action === "set") {
    value = normalizeMenuValue(key, parts.slice(3).join(":"));
  } else {
    await answerCallbackQuery(msg.callbackQueryId, "Unknown action");
    return;
  }

  const result = await executeTool("update_config", {
    changes: { [key]: value },
    reason: "Telegram settings menu",
  });
  if (!result?.success) {
    await answerCallbackQuery(msg.callbackQueryId, "Config update failed");
    return;
  }
  page = returnTokenForKey(key);
  await answerCallbackQuery(msg.callbackQueryId, `Updated ${key}`);
  await showSettingsMenu({ messageId: msg.messageId, page });
}

async function consumePendingInput(msg, text) {
  const pending = _pendingInput;
  _pendingInput = null;
  if (pending.action === "presetSave") {
    const name = text.trim();
    if (!validName(name)) {
      await sendMessage(`${ICON.warn} Nama tidak valid "${name}". Pakai huruf/angka/_/- (maks 40).`);
    } else {
      try {
        const r = savePreset(name);
        await sendMessage(`💾 Disimpan → preset "${name}"${r.overwritten ? " (nimpa yang lama)" : " (baru)"}.`);
      } catch (e) {
        await sendMessage(`${ICON.fail} Gagal simpan: ${e.message}`);
      }
    }
    await showSettingsMenu({ messageId: pending.menuMsgId, page: "presets" });
    return;
  }
  const { key, page, menuMsgId } = pending;
  if (isGmgnKey(key)) {
    await sendMessage(GMGN_GATE_TEXT);
    await showSettingsMenu({ messageId: menuMsgId, page });
    return;
  }
  let value;
  if (text.toLowerCase() === "off" || text.toLowerCase() === "null") {
    value = null;
  } else {
    value = Number(text);
    if (!Number.isFinite(value)) {
      await sendMessage(systemView.renderError(`Invalid value "${text}" — must be a number or "off".`));
      return;
    }
  }
  const result = await executeTool("update_config", { changes: { [key]: value }, reason: "Telegram input field" });
  if (!result?.success) {
    await sendMessage(`${ICON.fail} Failed to update ${key}.`);
    return;
  }
  await showSettingsMenu({ messageId: menuMsgId, page });
}

export function register(hooks) {
  initSettingsViews({ MENU_CONTROLS, buildConfigRowMap, renderSubclusterRows, subgroupDesc });
  hooks.on("telegram:command", async (ctx) => {
    const text = String(ctx.text || "").trim();
    const msg = ctx.msg || { text };
    if (_pendingInput && !msg.isCallback && !text.startsWith("/")) {
      await consumePendingInput(msg, text);
      ctx.handled = true;
      return;
    }
    if (msg?.isCallback && text.startsWith("cfg:")) {
      try {
        await applySettingsMenuCallback(msg);
      } catch (e) {
        await answerCallbackQuery(msg.callbackQueryId, e.message).catch(() => {});
      }
      ctx.handled = true;
      return;
    }
    if (text === "/settings" || text === "/menu" || text === "/configmenu") {
      await showSettingsMenu().catch((e) => sendMessage(`Settings error: ${e.message}`).catch(() => {}));
      ctx.handled = true;
    }
  }, 100);
}

export const __test = {
  MENU_CONTROLS,
  applySettingsMenuCallback,
  showSettingsMenu,
  consumePendingInput,
  getConfigValue,
  isGmgnKey,
};
