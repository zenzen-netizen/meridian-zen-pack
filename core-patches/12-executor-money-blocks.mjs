// Patch 12: tools/executor.js — blok money/display custom fork (FASE 5.5).
// Scope owner-locked 5.5 = 5 item: import sizing + blok 2 strategyLock + blok 3 conviction
// + blok 4 minDeploy/rent + blok 7 notify peakPnl.
// DEFER 5.7: blok 5 exitLiquidityCheck + blok 6 auto-swap (dep wallet.js absen di vanilla-test).
// DEFER (entangled): blok 1 update_config — fork-verbatim seret paths.js Batch-2 (executor
//   migration ditunda patch 02) + gmgn-config.json split-persistence. Bukan unit self-contained.
//
// Semua = replaceLine exact-match (verdict FASE A.2: blok 2/3/4 dipisah bersih, anchor beda
// count=1). NEW berisi backtick (log template / reason) → snip12/*.txt via readFileSync
// (verbatim, nol escaping). Blok 4b OLD juga backtick → snip. Anchor pendek tanpa backtick =
// String.raw inline. sizing.js diimport dari zenpack-lib/ (install: pack lib/ -> target zenpack-lib/).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = "zen-pack:12-executor-money-blocks";
// Baca snippet, buang SATU newline trailing (replaceLine tak sisip baris kosong).
const snip = (n) => readFileSync(join(here, "snip12", n), "utf8").replace(/\n$/, "");

// ── OLD anchors (vanilla-test/tools/executor.js, main; tiap count=1, diverifikasi FASE A) ──
const IMPORT_OLD = String.raw`import { config, reloadScreeningThresholds, MIN_SAFE_BINS_BELOW } from "../config.js";`;
const IMPORT_NEW = IMPORT_OLD + "\n" + String.raw`import { minDeployAmount, applyConvictionSizing } from "../zenpack-lib/sizing.js";`;

// Blok 2: sisip strategyLock override DI ATAS anchor poolThresholds (NEW berakhir dgn anchor).
const B2_OLD = String.raw`      const poolThresholds = await validateDeployPoolThresholds(args);`;

// Blok 3: sisip conviction sizing DI ATAS anchor komentar bin_step (NEW berakhir dgn anchor).
const B3_OLD = String.raw`      // Reject pools with bin_step out of configured range`;

// Blok 4a: minDeploy inline 0.1 -> minDeployAmount() (floor 0.03, verbatim fork).
const B4A_OLD = String.raw`      const minDeploy = Math.max(0.1, config.management.deployAmountSol);`;
const B4A_NEW = String.raw`      const minDeploy = minDeployAmount(); // shared floor — see config.js`;

export default [
  {
    file: "tools/executor.js",
    marker: M,
    replaces: [
      { old: IMPORT_OLD, new: IMPORT_NEW },                       // import sizing.js
      { old: B2_OLD, new: snip("2-strategylock-NEW.txt") },       // blok 2 strategyLock override
      { old: B3_OLD, new: snip("3-conviction-NEW.txt") },         // blok 3 applyConvictionSizing
      { old: B4A_OLD, new: B4A_NEW },                             // blok 4a minDeployAmount()
      { old: snip("4b-balance-OLD.txt"), new: snip("4b-balance-NEW.txt") }, // blok 4b + rentReserve
      { old: snip("7-notify-OLD.txt"), new: snip("7-notify-NEW.txt") },     // blok 7 notify peakPnl
    ],
  },
];
