# Progress 6.2 - dlmm.js paper branches

- ✅ F0 - Pre-flight
- ✅ F1 - Verifikasi dependensi (STOP: blocker ditemukan)
- ⬜ F2 - Patch 19a: import + A1
- ⬜ F3 - Patch 19b: A2 + A4
- ⬜ F4 - Patch 19c: A3
- ⬜ F5 - Gate
- ⬜ F6 - Manifest + tutup

## F0

- Pack HEAD: `e7b29d0 docs(5.10): keep stage value precise`; worktree bersih.
- Sandbox HEAD: `5ab14b4 fix(degen): timeframe-normalize Degen Score + recalibrate targets`.
- Sandbox adalah keadaan pack-terpasang terakhir; `tools/dlmm.js` tidak berbeda dari basis Git.
- `node --check tools/dlmm.js`: PASS.

## F1

Sumber dibaca dari committed branch `experimental` pada `643e954` dengan
`git show experimental:tools/dlmm.js`; working tree fork diabaikan karena kotor.
`plugins/paper-trading.js` sudah ada dan byte-identik dengan
`experimental:paper-trading.js` (SHA-256
`05cd4401ff66d0830f1b0d0eb29eb8f3e921ea64b03712722ccbf190a391d257`).

| Blok | Identifier | Sumber | Status vanilla-test |
|---|---|---|---|
| A0 | `isPaperMode`, `makePaperPositionId`, `simulatePaperMetrics`, `timeframeMinutes`, `classifyPaperEdge`, `formatPaperDecomposition` | `paper-trading.js` | Ada, export lengkap, byte-identik fork |
| A1 | `isPaperMode`, `makePaperPositionId` | `paper-trading.js` | Ada |
| A1 | `trackPosition`, `log` | import `state.js`, `logger.js` | Sudah ada |
| A1 | `Number`, `parseFloat`, `encodeURIComponent`, `fetch` | global/runtime | Ada |
| A1 | `activeBin`, `activeBinsBelow`, `activeBinsAbove`, `isSingleSidedSol`, `actualBinStep`, `pool`, `base_fee`, `activePrice`, `pool_name`, `baseMint`, `pool_address`, `finalAmountY`, `finalAmountX`, `normalizedVolatility`, `fee_tvl_ratio`, `organic_score`, `entry_mcap`, `entry_tvl`, `entry_volume`, `entry_holders` | lokal/parameter `deployPosition` | Ada |
| A1 | `paperSig`, `paperId`, `pMinBinId`, `pMaxBinId`, `pMinPrice`, `pMaxPrice`, `baseFactor`, `pBaseFee`, `coveragePct`, `displayName`, `f`, `detail`, `row`, `rf`, `rt`, `e` | deklarasi internal blok | Ada dalam blok |
| A1 | `dualSide` | kategori B, deklarasi fork `tools/dlmm.js:745` | **ABSEN**; vanilla single-side tidak mendeklarasikan ini |
| A1 | `narrative_category` | parameter fork `deployPosition`, `tools/dlmm.js:668` | **ABSEN** dari signature vanilla `tools/dlmm.js:452-475` |
| A2 | `isPaperMode` | `paper-trading.js` | Ada |
| A2 | `getTrackedPosition` | import `state.js` | Sudah ada |
| A2 | `computePaperMetrics` | A3 lokal | Ada hanya jika A3 terpasang |
| A2 | `String`, `Math`, `Number` | global/runtime | Ada |
| A2 | `tracked`, `m` | deklarasi internal blok | Ada dalam blok |
| A3 | `timeframeMinutes`, `simulatePaperMetrics`, `classifyPaperEdge`, `formatPaperDecomposition` | `paper-trading.js` | Ada |
| A3 | `getDLMM`, `getPool`, `getWallet`, `resolvePerformanceSignalSnapshot` | lokal `dlmm.js` | Sudah ada (`resolvePerformanceSignalSnapshot` vanilla L1040) |
| A3 | `getWalletBalances` | export `tools/wallet.js` | Export ada, tetapi **tidak diimport** oleh header vanilla `dlmm.js` |
| A3 | `minutesOutOfRange`, `markOutOfRange`, `markInRange`, `syncOpenPositions`, `getTrackedPosition`, `recordClose` | import `state.js` | Sudah ada |
| A3 | `getTrackedPositions` | export `state.js:310` | Export ada, tetapi **tidak diimport** oleh header vanilla `dlmm.js` |
| A3 | `recordPerformance`, `log`, `config` | import `lessons.js`, `logger.js`, `config.js` | Sudah ada |
| A3 | `estimateGasSol` | `reports.js:604`, dipakai fork `tools/dlmm.js:1604` | **BLOCKER**: bukan vanilla/paper; drop-in ada tetapi import gagal karena `lessons.js` tidak export `classifyNarrative` |
| A3 | `Date`, `Number`, `Math`, `String` | global/runtime | Ada |
| A3 | `_paperSolPrice`, `_paperSolPriceAt`, `PAPER_SOL_PRICE_TTL`, seluruh nama fungsi/helper dan variabel sisanya | deklarasi internal blok | Ada dalam blok |
| A4 | `process`, `String` | global/runtime | Ada |
| A4 | `isPaperMode` | `paper-trading.js` | Ada |
| A4 | `closePaperPosition` | A3 lokal | Ada hanya jika A3 terpasang |

### STOP report

1. A1 tidak dapat diport verbatim tanpa kategori B: ekspresi fork memakai
   `dualSide`, sedangkan scope melarang dual-side dan vanilla tidak punya
   deklarasinya.
2. A1 juga memakai `narrative_category`, tetapi parameter itu absen dari
   signature vanilla. Menambahnya bukan bagian A0/A1 yang dijelaskan brief.
3. A3 menarik `estimateGasSol` dari `reports.js`, dependensi yang disebut aturan
   STOP dan dikunci sebagai utang kategori H 6.4/6.5. Uji import aktual gagal:
   `SyntaxError: lessons.js does not provide an export named classifyNarrative`.
4. A3 membutuhkan dua wiring import non-paper tambahan (`getWalletBalances`,
   `getTrackedPositions`), sementara A0 mengunci header hanya ke enam import
   `paper-trading.js`.

Tidak ada patch 19a/b/c dibuat dan sandbox tidak diubah pada F1.
