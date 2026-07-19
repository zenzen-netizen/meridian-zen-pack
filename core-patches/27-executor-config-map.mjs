// Patch 27 compatibility bootstrap. PRA-8 supersedes the old additive whitelist
// with the complete handler below. Keeping this first step lets both a pristine
// target and a target carrying the old Patch 27 converge on one exact OLD block.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip27", name), "utf8");
const FULL_ALREADY = "// [zen-pack:27-full] Patch 27 whitelist superseded";

const legacyWhitelist = {
  file: "tools/executor.js",
  marker: "zen-pack:27-executor-config-map",
  anchor: `      loneCandidateMinDegen: ["screening", "loneCandidateMinDegen"],`,
  already: FULL_ALREADY,
  inject: [
    `      // custom non-GMGN config keys (fork CONFIG_MAP @643e954)`,
    `      screeningSource: ["screening", "source"],`,
    `      screeningCategories: ["screening", "categories"],`,
    `      gasReserveAutoTune: ["management", "gasReserveAutoTune"],`,
    `      gasReserveBufferDays: ["management", "gasReserveBufferDays"],`,
    `      gasReserveFloorSol: ["management", "gasReserveFloorSol"],`,
    `      sizingMode: ["management", "sizingMode"],`,
    `      rentPerPositionSol: ["management", "rentPerPositionSol"],`,
    `      adaptiveScreening: ["schedule", "adaptiveScreening"],`,
    `      maxScreeningIntervalMin: ["schedule", "maxScreeningIntervalMin"],`,
    `      generalMaxTokens: ["llm", "generalMaxTokens"],`,
    `      strategyLock: ["strategy", "strategyLock"],`,
    `      indicatorExitEnabled: ["indicators", "exitEnabled", ["chartIndicators", "exitEnabled"]],`,
    `      indicatorRejectAtBottom: ["indicators", "rejectAlreadyAtBottom", ["chartIndicators", "rejectAlreadyAtBottom"]],`,
    `      smiPdLookback: ["indicators", "smiPdLookback", ["chartIndicators", "smiPdLookback"]],`,
    `      smiPaLookback: ["indicators", "smiPaLookback", ["chartIndicators", "smiPaLookback"]],`,
    `      smiCrossWindow: ["indicators", "smiCrossWindow", ["chartIndicators", "smiCrossWindow"]],`,
    `      exitLiquidityCheck: ["experiments", "exitLiquidityCheck"],`,
    `      exitLiquidityMaxSlippagePct: ["experiments", "exitLiquidityMaxSlippagePct"],`,
    `      marketRegimeGate: ["experiments", "marketRegimeGate"],`,
    `      marketRegimeMaxDrop24hPct: ["experiments", "marketRegimeMaxDrop24hPct"],`,
    `      candidateMomentum: ["experiments", "candidateMomentum"],`,
    `      narrativeProfileSignal: ["experiments", "narrativeProfileSignal"],`,
    `      expectedYieldSignal: ["experiments", "expectedYieldSignal"],`,
    `      convictionSizing: ["experiments", "convictionSizing"],`,
    `      convictionSizingMaxAdjustPct: ["experiments", "convictionSizingMaxAdjustPct"],`,
    `      counterfactualReview: ["experiments", "counterfactualReview"],`,
    `      counterfactualMinMcapGainPct: ["experiments", "counterfactualMinMcapGainPct"],`,
    `      smartWalletMomentum: ["experiments", "smartWalletMomentum"],`,
    `      idleScreeningCooldown: ["experiments", "idleScreeningCooldown"],`,
    `      idleScreeningCooldownMin: ["experiments", "idleScreeningCooldownMin"],`,
    `      paperTrading: ["experiments", "paperTrading"],`,
    `      usePaperHistoryWhenLive: ["experiments", "usePaperHistoryWhenLive"],`,
    `      learningReportEvery: ["reports", "learningReportEvery"],`,
    `      learningReportTrendN: ["reports", "learningReportTrendN"],`,
    `      evolveEnabled: ["learning", "evolveEnabled"],`,
  ].join("\n"),
};

const REDACTION_HELPERS = `const SENSITIVE_CONFIG_KEYS = new Set([
  "gmgnApiKey",
  "hiveMindApiKey",
  "publicApiKey",
]);

function redactConfigValue(key, value) {
  if (!SENSITIVE_CONFIG_KEYS.has(key)) return value;
  return typeof value === "string" && value ? "***redacted***" : value;
}

function redactAppliedConfig(applied) {
  return Object.fromEntries(
    Object.entries(applied || {}).map(([key, value]) => [key, redactConfigValue(key, value)]),
  );
}`;

export default [
  legacyWhitelist,
  {
    file: "tools/executor.js",
    marker: "zen-pack:27-config-schema-import",
    anchor: `import { minDeployAmount, applyConvictionSizing } from "../zenpack-lib/sizing.js";`,
    inject: `import { validateConfigValue } from "../config-schema.js";`,
    already: `import { validateConfigValue } from "../config-schema.js";`,
  },
  {
    file: "tools/executor.js",
    replaces: [{
      old: `const USER_CONFIG_PATH = paths.userConfigPath;`,
      new: `const USER_CONFIG_PATH = paths.userConfigPath;\nconst GMGN_CONFIG_PATH = paths.gmgnConfigPath;`,
    }],
  },
  {
    file: "tools/executor.js",
    marker: "zen-pack:27-config-redaction",
    anchor: `import { notifyDeploy, notifyClose, notifySwap } from "../telegram.js";`,
    inject: REDACTION_HELPERS,
    already: `const SENSITIVE_CONFIG_KEYS = new Set([`,
  },
  {
    file: "tools/executor.js",
    replaces: [{
      old: snip("update-config-OLD.txt"),
      new: snip("update-config-NEW.txt"),
      already: FULL_ALREADY,
    }],
  },
  {
    file: "tools/definitions.js",
    replaces: [{
      old: snip("definition-OLD.txt"),
      new: snip("definition-NEW.txt"),
      already: `Non-GMGN changes persist to user-config.json; GMGN tuning persists to gmgn-config.json.`,
    }],
  },
];
