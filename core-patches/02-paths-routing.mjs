// Patch 02: alihkan semua titik baca/tulis file DATA core lewat paths.js (drop-in root).
// Tanpa MERIDIAN_DATA_DIR -> paths.* default REPO_ROOT = perilaku IDENTIK vanilla.
// SKIP (sengaja): envcrypt.js (.env selalu root), setup.js, hivemind.js:9 (package.json
// = identitas kode), dev-blocklist.js (preseden fork).
// Batch 1 = file data murni. Batch 2 (config.js, telegram.js, tools/executor.js, index.js) menyusul.
const M = "zen-pack:02-paths-routing";
const IMP = `import { paths } from "./paths.js";`;
const ANCHOR = `import { repoPath } from "./repo-root.js";`;

export default [
  // ── Batch 1 ──
  { file: "state.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const STATE_FILE = repoPath("state.json");`, new: `const STATE_FILE = paths.statePath;` },
  ]},
  { file: "lessons.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const USER_CONFIG_PATH = repoPath("user-config.json");`, new: `const USER_CONFIG_PATH = paths.userConfigPath;` },
    { old: `const LESSONS_FILE = repoPath("lessons.json");`, new: `const LESSONS_FILE = paths.lessonsPath;` },
  ]},
  { file: "hivemind.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const USER_CONFIG_PATH = repoPath("user-config.json");`, new: `const USER_CONFIG_PATH = paths.userConfigPath;` },
    { old: `const CACHE_PATH = repoPath("hivemind-cache.json");`, new: `const CACHE_PATH = paths.hivemindCachePath;` },
    // hivemind.js:9 PACKAGE_JSON_PATH sengaja TIDAK diubah (identitas kode, bukan data)
  ]},
  { file: "briefing.js", marker: M, anchor: ANCHOR, inject: IMP, already: IMP, replaces: [
    { old: `const STATE_FILE = repoPath("state.json");`, new: `const STATE_FILE = paths.statePath;` },
    { old: `const LESSONS_FILE = repoPath("lessons.json");`, new: `const LESSONS_FILE = paths.lessonsPath;` },
  ]},
  { file: "pool-memory.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const POOL_MEMORY_FILE = repoPath("pool-memory.json");`, new: `const POOL_MEMORY_FILE = paths.poolMemoryPath;` },
  ]},
  { file: "smart-wallets.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const WALLETS_PATH = repoPath("smart-wallets.json");`, new: `const WALLETS_PATH = paths.smartWalletsPath;` },
  ]},
  { file: "token-blacklist.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const BLACKLIST_FILE = repoPath("token-blacklist.json");`, new: `const BLACKLIST_FILE = paths.tokenBlacklistPath;` },
  ]},
  { file: "strategy-library.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const STRATEGY_FILE = repoPath("strategy-library.json");`, new: `const STRATEGY_FILE = paths.strategyLibraryPath;` },
  ]},
  { file: "signal-weights.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const WEIGHTS_FILE = repoPath("signal-weights.json");`, new: `const WEIGHTS_FILE = paths.signalWeightsPath;` },
  ]},
  { file: "decision-log.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const DECISION_LOG_FILE = repoPath("decision-log.json");`, new: `const DECISION_LOG_FILE = paths.decisionLogPath;` },
  ]},
  { file: "logger.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const LOG_DIR = repoPath("logs");`, new: `const LOG_DIR = paths.logDir;` },
  ]},

  // ── Batch 2 (file panas) ──
  { file: "config.js", marker: M, anchor: `import { REPO_ROOT, repoPath } from "./repo-root.js";`, inject: IMP, replaces: [
    { old: `const USER_CONFIG_PATH = repoPath("user-config.json");`, new: `const USER_CONFIG_PATH = paths.userConfigPath;` },
    { old: `const GMGN_CONFIG_PATH = repoPath("gmgn-config.json");`, new: `const GMGN_CONFIG_PATH = paths.gmgnConfigPath;` },
  ]},
  { file: "telegram.js", marker: M, anchor: ANCHOR, inject: IMP, replaces: [
    { old: `const USER_CONFIG_PATH = repoPath("user-config.json");`, new: `const USER_CONFIG_PATH = paths.userConfigPath;` },
  ]},
  { file: "tools/executor.js", marker: M, anchor: `import { REPO_ROOT, repoPath } from "../repo-root.js";`, inject: `import { paths } from "../paths.js";`, replaces: [
    { old: `const USER_CONFIG_PATH = repoPath("user-config.json");`, new: `const USER_CONFIG_PATH = paths.userConfigPath;` },
  ]},
  { file: "index.js", marker: M, anchor: `import { REPO_ROOT, repoPath } from "./repo-root.js";`, inject: IMP, replaces: [
    { old: `JSON.parse(fs.default.readFileSync(repoPath("lessons.json"), "utf8"))`, new: `JSON.parse(fs.default.readFileSync(paths.lessonsPath, "utf8"))` },
  ]},
];
