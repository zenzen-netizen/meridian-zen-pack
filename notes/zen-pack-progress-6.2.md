# Progress 6.2 - dlmm.js paper branches

- ✅ F0 - Pre-flight
- ✅ F1 - Verifikasi dependensi + keputusan owner atas 4 blocker
- ✅ F2 - Patch 19a: import + A1
- ✅ F3 - Patch 19b: A2 + A4
- ✅ F4 - Patch 19c: A3
- ✅ F5 - Gate
- ✅ F6 - Manifest + tutup

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

### Keputusan owner (Addendum Brief 6.2)

1. `dualSide`: A1 memakai bentuk vanilla tanpa `!dualSide`; kategori B tetap
   ditunda. Kode wajib membawa marker restore ke patch dual-side 6.3.
2. `narrative_category`: ditambahkan verbatim ke destructuring `deployPosition`
   agar konsisten dengan schema patch 13; caller tanpa field aman (`null`).
3. `estimateGasSol`: dibuat shim `zenpack-lib/gas-est.js` dari
   `experimental:reports.js:596-606`; A3 mengimpor shim, bukan `reports.js`.
   Re-point ke `../reports.js` dan hapus shim ditunda ke 6.4/6.5.
4. Scope A0 dikoreksi: selain import `paper-trading.js`, perluasan import
   existing `wallet.js` (`getWalletBalances`) dan `state.js`
   (`getTrackedPositions`) diizinkan. Modul absent lain tetap STOP.

## F2 - Patch 19a

- `19a-dlmm-paper-deploy.mjs`: perluasan import A0, parameter
  `narrative_category`, dan blok A1 paper deploy.
- `pMaxBinId` memakai bentuk vanilla yang diputuskan owner dan marker tunggal:
  `// ZP-6.2: !dualSide ditunda — dipulihkan patch dual-side 6.3`.
- Kategori B dual-side tidak disentuh.

## F3 - Patch 19b

- A2: `getPositionPnl` merutekan id `paper_` ke `computePaperMetrics`.
- A4: `closePosition` DRY_RUN merutekan id `paper_` ke
  `closePaperPosition`; jalur factory non-paper tetap utuh.

## F4 - Patch 19c

- A3 dipasang verbatim: estimator metric, row/list paper, close +
  `recordPerformance`, decomposition, dan dispatch `getMyPositions`.
- `lib/gas-est.js` byte-identik `experimental:reports.js:596-606`; hasil
  round-trip estimator = `0.0001 SOL`.
- Import A3 memakai `../zenpack-lib/gas-est.js`; `reports.js` tidak diport.

## F5 - Gate

- `node --check`: tiga patch, shim, dan target `tools/dlmm.js` PASS.
- Import aktual `tools/dlmm.js`: PASS; boot DRY_RUN: 6 plugin loaded, 0
  skipped, 0 errors; berhenti timeout sesudah baseline 401, nol transaksi.
- `tests/dlmm-paper.test.mjs`: 6/6 PASS, termasuk LAPIS 1 flag-OFF
  before/after identik (`diff: []`) dan LAPIS 2 flag-ON menghasilkan posisi
  `paper_*` yang hidup di listing, PnL+close sukses, serta `ZERO-TX: 0`.
  Harness memulihkan `state.json`, `lessons.json`, dan `pool-memory.json`.
  Full regression harness: seluruh
  suite PASS (termasuk agent 8, agentloop 14, config 15, definitions 4,
  executor 10+13+14, prompt 8, screening 4, SMI 4, telegram 19+5,
  wallet 5). Pack smoke dan target syntax test PASS.
- Idempotensi patch 19: 4+2+1 replacement semuanya
  `skipped-idempotent` pada pass berikutnya.
- Siklus uninstall memulihkan seluruh file core termasuk `tools/dlmm.js`
  dengan hash `clean`; reinstall memasang 19a/b/c dan shim lagi. Artefak
  `exports/` + `profiles/` yang dibuat harness dipindah (recoverable) ke
  `/tmp/zenpack-6.2-test-artifacts.ND3BfM` sebelum gate akhir.

### Laporan diff paper vs fork

- A1 raw diff memuat tepat: **(a)** komentar marker dan **(b)** baris
  `pMaxBinId` bentuk vanilla tanpa `!dualSide`. Setelah dua normalisasi itu,
  A1 identik.
- A2, A3, dan A4: byte-identik fork (diff kosong).
- Import `estimateGasSol`: tepat satu diff **(c)**,
  `../reports.js` → `../zenpack-lib/gas-est.js`.
- Golden reference aktual: A1 setelah normalisasi, A2, A3, A4, dan
  `gas-est.js` seluruhnya `diff` kosong. Telegram target: 19/19.
- Tidak ada perbedaan blok paper lain.

## F6 - Manifest + tutup

- Stage manifest dinaikkan ke `6.2`; patch 19a/19b/19c dicatat.
- DEVIASI-SADAR #3: exit vanilla 2-tick dipertahankan.
- Utang `trough_pnl_pct`, `price_peak_pct`/`price_trough_pct`, dan
  `peakPnl`/`peak_pnl_pct` → 7.8/7.9.
- Utang shim gas: re-point import ke `../reports.js` + hapus shim → 6.4/6.5.
- Restore `!dualSide` → 6.3.
- Nol sentuh bot live.
