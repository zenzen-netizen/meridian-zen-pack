// Patch 06: netralkan AUTO-SEED strategi default di strategy-library.js.
// Vanilla-main: `ensureDefaultStrategies();` top-level (L115) auto-isi 5 strategi
// + set active saat modul load. Fork + yunus-experimental: blok itu DIHAPUS.
// Target: perilaku fork = buku strategi tetap kosong, nol auto-pick.
// Definisi DEFAULT_STRATEGIES (L29) + function ensureDefaultStrategies (L95)
// SENGAJA dibiarkan (jadi dead code) — setia byte ke vanilla selain 1 baris ini.
// Routing STRATEGY_FILE→paths.* sudah patch 02 — JANGAN sentuh.
const M = "zen-pack:06-strategy-no-autoseed";

export default [
  { file: "strategy-library.js", marker: M, replaces: [
    { old: `ensureDefaultStrategies();`,
      new: `/* [zen-pack:06] auto-seed disabled — match fork/experimental */` },
  ]},
];
