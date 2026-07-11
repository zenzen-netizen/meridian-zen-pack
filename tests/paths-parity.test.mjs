// Paritas Stage 3.2: TANPA MERIDIAN_DATA_DIR, tiap key paths.* yang di-route patch 02
// WAJIB identik dengan lokasi lama repoPath("x"). Jalankan terhadap target ter-install:
//   node tests/paths-parity.test.mjs <path-target>
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/paths-parity.test.mjs <path-target>"); process.exit(1); }
delete process.env.MERIDIAN_DATA_DIR;
delete process.env.MERIDIAN_CONFIG_PATH;

const { paths } = await import(pathToFileURL(join(target, "paths.js")).href);
const { repoPath } = await import(pathToFileURL(join(target, "repo-root.js")).href);

// key -> nama file lama (peta [A] brief 3.2)
const MAP = {
  userConfigPath: "user-config.json",
  gmgnConfigPath: "gmgn-config.json",
  statePath: "state.json",
  lessonsPath: "lessons.json",
  hivemindCachePath: "hivemind-cache.json",
  poolMemoryPath: "pool-memory.json",
  smartWalletsPath: "smart-wallets.json",
  tokenBlacklistPath: "token-blacklist.json",
  strategyLibraryPath: "strategy-library.json",
  signalWeightsPath: "signal-weights.json",
  decisionLogPath: "decision-log.json",
  logDir: "logs",
};

let pass = 0, fail = 0;
for (const [key, file] of Object.entries(MAP)) {
  try {
    assert.strictEqual(paths[key], repoPath(file));
    console.log(`  ✅ ${key} == repoPath("${file}")`);
    pass++;
  } catch {
    console.log(`  ❌ ${key}: ${paths[key]} != ${repoPath(file)}`);
    fail++;
  }
}
console.log(`\nPARITAS: ${pass}/${pass + fail} lolos`);
process.exit(fail ? 1 : 0);
