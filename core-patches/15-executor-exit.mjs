// Patch 15: tools/executor.js — blok 5 exitLiquidityCheck (FASE 5.7 langkah 2: money).
// Utang DEFER 5.5 dilunasi SEBAGIAN: blok 5 exit-liquidity probe (deploy path). Blok 6
// auto-swap DEFER (owner) — vanilla executor SUDAH punya swapBaseToSolWithRetry lokal
// (L612) + close/claim wired; premis gating brief keliru (close-path TAK gated). Nol rugi.
//
// GATED default-OFF: `config.experiments?.exitLiquidityCheck` (config-ext 50 L103 = false).
// Flag-OFF = jalur identik vanilla (blok tak dieksekusi). Fail-open: probe throw -> deploy
// LANJUT (catch log-only). Punya guard `process.env.DRY_RUN !== "true"` sendiri (paper skip).
//
// DEVIASI-SADAR fork import: fork import 4 nama dari wallet.js
// (getWalletBalances, swapToken, quoteSellPriceImpact, swapBaseToSolWithRetry). Di sini HANYA
// tambah quoteSellPriceImpact — swapBaseToSolWithRetry DILEPAS krn (a) blok 6 DEFER, (b) nama
// BENTROK dgn fungsi lokal vanilla executor.js:612. Saat blok 6 diport nanti: tambah nama +
// buang fungsi lokal bareng.
//
// 2 replaceLine exact-unik (FASE C recon: junction close-brace+blank+return count=1). Blok 5
// punya backtick (log-template) -> snip15/*.txt readFileSync RAW.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = "zen-pack:15-executor-exit";
const snip = (n) => readFileSync(join(here, "snip15", n), "utf8");

// H1: tambah quoteSellPriceImpact ke import wallet.js (BUKAN swapBaseToSolWithRetry — lihat header).
const IMPORT_OLD = String.raw`import { getWalletBalances, swapToken } from "./wallet.js";`;
const IMPORT_NEW = String.raw`import { getWalletBalances, swapToken, quoteSellPriceImpact } from "./wallet.js";`;

// H2: sisip blok 5 di antara guard SOL-balance close dan `return { pass: true }` (deploy
// validation). Anchor 3-baris junction = count=1 (return{pass:true} sendiri muncul 4x).
const B5_OLD = "      }\n\n      return { pass: true };";
const B5_NEW = "      }\n\n" + snip("5-exitliquidity.txt") + "\n\n      return { pass: true };";

export default [
  {
    file: "tools/executor.js",
    marker: M,
    replaces: [
      { old: IMPORT_OLD, new: IMPORT_NEW }, // H1 import quoteSellPriceImpact
      { old: B5_OLD,     new: B5_NEW },      // H2 blok 5 exitLiquidityCheck (gated, fail-open)
    ],
  },
];
