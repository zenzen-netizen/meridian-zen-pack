import {
  constants,
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";

const BACKUP_SUFFIX = ".pre-zenpack-pra8.bak";

// Legacy user-config key -> canonical gmgn-config path. Includes the complete
// fork loader surface; the six indicator rules are nested in indicatorRules.
export const LEGACY_GMGN_PATHS = {
  gmgnApiKey: ["apiKey"],
  gmgnBaseUrl: ["baseUrl"],
  gmgnFeeSource: ["feeSource"],
  gmgnInterval: ["interval"],
  gmgnOrderBy: ["orderBy"],
  gmgnDirection: ["direction"],
  gmgnLimit: ["limit"],
  gmgnEnrichLimit: ["enrichLimit"],
  gmgnRequestDelayMs: ["requestDelayMs"],
  gmgnMaxRetries: ["maxRetries"],
  gmgnHoldersLimit: ["holdersLimit"],
  gmgnKlineResolution: ["klineResolution"],
  gmgnKlineLookbackMinutes: ["klineLookbackMinutes"],
  gmgnFilters: ["filters"],
  gmgnPlatforms: ["platforms"],
  gmgnMinMcap: ["minMcap"],
  gmgnMaxMcap: ["maxMcap"],
  gmgnMinTvl: ["minTvl"],
  gmgnMinVolume: ["minVolume"],
  gmgnMinHolders: ["minHolders"],
  gmgnMinTokenAgeHours: ["minTokenAgeHours"],
  gmgnMaxTokenAgeHours: ["maxTokenAgeHours"],
  gmgnMinSmartDegenCount: ["minSmartDegenCount"],
  gmgnRequireKol: ["requireKol"],
  gmgnMinKolCount: ["minKolCount"],
  gmgnMaxRugRatio: ["maxRugRatio"],
  gmgnMaxTop10HolderRate: ["maxTop10HolderRate"],
  gmgnMaxBundlerRate: ["maxBundlerRate"],
  gmgnMaxRatTraderRate: ["maxRatTraderRate"],
  gmgnMaxFreshWalletRate: ["maxFreshWalletRate"],
  gmgnMaxDevTeamHoldRate: ["maxDevTeamHoldRate"],
  gmgnPreferredKolMinHoldPct: ["preferredKolMinHoldPct"],
  gmgnDumpKolMinHoldPct: ["dumpKolMinHoldPct"],
  gmgnMaxBotDegenRate: ["maxBotDegenRate"],
  gmgnMaxSniperCount: ["maxSniperCount"],
  gmgnMaxSniperHoldRate: ["maxSniperHoldRate"],
  gmgnMinTotalFeeSol: ["minTotalFeeSol"],
  gmgnAthFilterPct: ["athFilterPct"],
  gmgnPreferredKolNames: ["preferredKolNames"],
  gmgnDumpKolNames: ["dumpKolNames"],
  gmgnIndicatorFilter: ["indicatorFilter"],
  gmgnIndicatorInterval: ["indicatorInterval"],
  gmgnRequireBullishSt: ["indicatorRules", "requireBullishSupertrend"],
  gmgnRejectAtBottom: ["indicatorRules", "rejectAlreadyAtBottom"],
  gmgnRequireAboveSt: ["indicatorRules", "requireAboveSupertrend"],
  gmgnMinRsi: ["indicatorRules", "minRsi"],
  gmgnMaxRsi: ["indicatorRules", "maxRsi"],
  gmgnRequireBbPosition: ["indicatorRules", "requireBbPosition"],
};

function parseJson(filePath, label) {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} tidak valid: ${error.message}`);
  }
}

function hasPath(object, path) {
  let current = object;
  for (const part of path) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, part)) return false;
    current = current[part];
  }
  return true;
}

function setPath(object, path, value) {
  let current = object;
  for (const part of path.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
  current[path.at(-1)] = value;
}

function backupOnce(filePath) {
  const backupPath = `${filePath}${BACKUP_SUFFIX}`;
  try {
    copyFileSync(filePath, backupPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return backupPath;
}

function writeJsonAtomic(filePath, object) {
  const tempPath = `${filePath}.zenpack-pra8-${process.pid}.tmp`;
  const mode = existsSync(filePath) ? statSync(filePath).mode & 0o777 : 0o600;
  writeFileSync(tempPath, `${JSON.stringify(object, null, 2)}\n`, { mode });
  renameSync(tempPath, filePath);
}

export function migrateLegacyGmgnConfig({ userConfigPath, gmgnConfigPath }) {
  if (!existsSync(userConfigPath)) {
    return { migrated: [], preservedUnknown: [], backups: [], changed: false };
  }

  // Parse both before any backup/write. Corruption is fail-closed.
  const userConfig = parseJson(userConfigPath, "user-config.json");
  const gmgnConfig = parseJson(gmgnConfigPath, "gmgn-config.json");
  const legacyKeys = Object.keys(userConfig).filter((key) => key.startsWith("gmgn"));
  const migrated = [];
  const preservedUnknown = [];

  for (const key of legacyKeys) {
    const canonicalPath = LEGACY_GMGN_PATHS[key];
    if (!canonicalPath) {
      preservedUnknown.push(key);
      continue;
    }
    if (!hasPath(gmgnConfig, canonicalPath)) setPath(gmgnConfig, canonicalPath, userConfig[key]);
    delete userConfig[key];
    migrated.push(key);
  }

  if (!migrated.length) return { migrated, preservedUnknown, backups: [], changed: false };

  const backups = [backupOnce(userConfigPath)];
  if (existsSync(gmgnConfigPath)) backups.push(backupOnce(gmgnConfigPath));

  // GMGN first: interruption can only leave safe duplication. A rerun finishes.
  writeJsonAtomic(gmgnConfigPath, gmgnConfig);
  writeJsonAtomic(userConfigPath, userConfig);
  return { migrated, preservedUnknown, backups, changed: true };
}
