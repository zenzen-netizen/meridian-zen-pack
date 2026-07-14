// Patch 14: tools/wallet.js — port custom fork VERBATIM (FASE 5.7 langkah 1: alat).
// Owner-locked FULL-PARITY: wallet.js dijadikan sama-kode dgn fork (bukan cuma 4 fungsi
// append). Recon FASE A menemukan fork wallet.js = vanilla + 4 fungsi additive + 4 SISIPAN
// di dalam fungsi vanilla existing (di luar peta awal "pure-additive/nol baris diubah"):
//   H1 import trackTxGas/recordSolBalance (gas-tracker.js/sol-tracker.js, drop-in Stage 2)
//   H2 referralEnabled early-return di getJupiterReferralParams (dep config.jupiter.referralEnabled
//      SUDAH ada via config-ext 50 L90)
//   H3 blok DRY_RUN paper virtual-balance di getWalletBalances (relevan paper-mode FASE D)
//   H4 recordSolBalance call di getWalletBalances (sol-tracker calendar-day)
//   H5 JUPITER_QUOTE_API + jupiterQuote + quoteSellPriceImpact + getSolMarketRegime (4 fungsi inti)
//   H6 trackTxGas call di swapToken (gas-tracker)
//   H7 swapBaseToSolWithRetry EOF (feeds blok 6 executor — DEFER, dead export utk kini)
//
// Semua VERBATIM fork. H1/H2/H6 tanpa backtick/backslash -> inline. H3/H4/H5/H7 punya
// backtick (log-template) atau blank-line adjacency -> snip14/*.txt readFileSync RAW
// (nol escaping = jaminan verbatim; file di-generate = slice fork strip SATU trailing \n,
// NEW = OLD + "\n" + snip reproduksi fork byte-exact, blank-line ikut). H1-H6 replaceLine
// exact-unik (count=1 diverifikasi FASE A), H7 appendPatch (marker [zen-pack:14]).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = "zen-pack:14-wallet-ext";
// RAW read (TAK strip): file snip sudah di-generate tanpa trailing \n berlebih; NEW =
// OLD + "\n" + snip menaruh sisipan di antara anchor dan baris vanilla berikutnya.
const snip = (n) => readFileSync(join(here, "snip14", n), "utf8");

// ── OLD anchors (vanilla-test/tools/wallet.js; tiap count=1, diverifikasi FASE A) ──
const IMPORT_OLD   = String.raw`import { config } from "../config.js";`;
const IMPORT_NEW   = IMPORT_OLD + "\n" +
  `import { trackTxGas } from "../gas-tracker.js";` + "\n" +
  `import { recordSolBalance } from "../sol-tracker.js";`;

// H2: referralEnabled early-return = baris pertama badan getJupiterReferralParams (sisip DI BAWAH anchor).
const REFERRAL_OLD = String.raw`function getJupiterReferralParams() {`;
const REFERRAL_NEW = REFERRAL_OLD + "\n" +
  `  if (config.jupiter.referralEnabled === false) return null;`;

// H3: blok paper virtual-balance = baris pertama badan getWalletBalances (sisip DI BAWAH anchor).
const WB_OLD       = String.raw`export async function getWalletBalances() {`;
const WB_NEW       = WB_OLD + "\n" + snip("3-paper.txt");

// H4: recordSolBalance disisip DI BAWAH anchor usdcBalance (snip diawali blank line).
const USDC_OLD     = String.raw`    const usdcBalance = usdcEntry?.balance || 0;`;
const USDC_NEW     = USDC_OLD + "\n" + snip("4-recordsol.txt");

// H5: 4 fungsi inti disisip DI ATAS anchor komentar normalizeMint (NEW berakhir dgn anchor).
const NORM_OLD     = String.raw`// Normalize any SOL-like address to the correct wrapped SOL mint`;
const NORM_NEW     = snip("5-jupiter.txt") + "\n" + NORM_OLD;

// H6: trackTxGas call disisip DI ATAS anchor if(referralParams) (NEW berakhir dgn anchor).
const GAS_OLD      = String.raw`    if (referralParams && order.feeBps !== referralParams.referralFee) {`;
const GAS_NEW      = `    trackTxGas(getConnection(), result.signature, "swap"); // real gas capture, fail-open` +
  "\n" + GAS_OLD;

export default [
  {
    file: "tools/wallet.js",
    marker: M,
    replaces: [
      { old: IMPORT_OLD,   new: IMPORT_NEW },   // H1 import trackTxGas/recordSolBalance
      { old: REFERRAL_OLD, new: REFERRAL_NEW }, // H2 referralEnabled early-return
      { old: WB_OLD,       new: WB_NEW },        // H3 paper virtual-balance block
      { old: USDC_OLD,     new: USDC_NEW },      // H4 recordSolBalance call
      { old: NORM_OLD,     new: NORM_NEW },      // H5 jupiterQuote+quoteSellPriceImpact+getSolMarketRegime
      { old: GAS_OLD,      new: GAS_NEW },       // H6 trackTxGas call
    ],
    append: snip("7-swapbase.txt"),              // H7 swapBaseToSolWithRetry (EOF, marker)
  },
];
