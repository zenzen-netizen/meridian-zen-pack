// Patch 08: titik hook "config:reload" di AKHIR badan reloadScreeningThresholds
// (config.js). Plugin 50-config-ext dengar hook ini → re-apply key custom
// (promptNotes/activeSetup/evolveEnabled/sizingMode/rentPerPositionSol/
// screeningCategories) dari user-config fresh — samakan ke reload fork
// (fork config.js:638-647).
//
// BENTUK SYNC (bukan `await import`): reloadScreeningThresholds vanilla = NON-async
// (config.js:295 `export function`, tanpa async). Jadi:
//   item A = import STATIS `emitSync` di atas file (anchor beda dari patch 02 biar
//            tak rancu: pakai baris import screening-scales, bukan repo-root).
//   item B = panggil `emitSync("config:reload", {config, fresh})` LANGSUNG di akhir
//            badan try (sesudah blok defaultBinsBelow Math.max, sebelum `} catch`).
// hooks.js DIJAMIN ada pasca-install (install.sh copy lib/ → zenpack-lib/), jadi
// import statis aman (tak bikin config.js crash saat load). Call di-wrap try/catch
// = fail-open runtime: handler plugin error → reload vanilla tetap tuntas.
const M_IMPORT = "zen-pack:08-config-reload-import";
const M_HOOK   = "zen-pack:08-config-reload-hook";

const ANCHOR_HOOK = `    config.strategy.defaultBinsBelow = Math.max(
      config.strategy.minBinsBelow,
      Math.min(config.strategy.maxBinsBelow, Math.round(defaultBinsBelow)),
    );`;

export default [
  { file: "config.js", marker: M_IMPORT,
    anchor: `import { getScreeningDefaultsForTimeframe, normalizeTimeframe, scaleScreeningToTimeframe, TIMEFRAME_SCREENING_SCALES } from "./screening-scales.js";`,
    inject: `import { emitSync } from "./zenpack-lib/hooks.js"; // [zen-pack:08] config:reload bus (sync)` },

  { file: "config.js", marker: M_HOOK,
    anchor: ANCHOR_HOOK,
    inject: `    // [zen-pack:08] emit config:reload — plugin re-apply key custom dari \`fresh\`.
    try { emitSync("config:reload", { config, fresh }); } catch { /* fail-open: reload vanilla tetap tuntas */ }` },
];
