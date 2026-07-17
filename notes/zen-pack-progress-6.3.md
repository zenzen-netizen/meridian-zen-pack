# Progress 6.3 - dlmm.js custom non-paper

- ✅ F0 - Pre-flight
- ✅ F1 - Inventaris dependensi; STOP-LAPOR (3 dependensi absen)
- ⬜ F2 - Patch 20a: dual-side + restore `!dualSide`
- ⬜ F3 - Patch 20b: `sendTxTracked`
- ⬜ F4 - Patch 20c: relay circuit breaker
- ⬜ F5 - Patch 20d/20e: shadow signals, cleanup, rent, dan logging
- ⬜ F6 - Gate
- ⬜ F7 - Manifest + tutup

## F0 - Pre-flight

`a5005c4 | pack clean | sandbox pack-terpasang pasca-6.2 | node --check tools/dlmm.js PASS`

Sumber kebenaran dibaca dari committed branch `experimental` repo
`zenzen-netizen/zenmerimerizen` pada `643e954` dengan `git show`; working tree
fork tidak dijadikan sumber. Sandbox HEAD vanilla adalah `5ab14b4` dan perubahan
yang terlihat adalah state instalasi pack, bukan perubahan fase 6.3.

## F1 - Inventaris dependensi

| Kategori | Identifier eksternal | Modul/sumber | Status di vanilla/sandbox |
|---|---|---|---|
| B | `config.strategy.dualSideEnabled`, `dualSideTokenPct`, `dualSideUpsidePct`, `dualSideStrategy` | `config.js` fork | **ABSEN** dari object `config.strategy` sandbox dan schema user config; gerbang ON tidak dapat dihidupkan verbatim |
| B | `swapToken` | `tools/wallet.js` | Export ada; belum diimport `tools/dlmm.js` |
| B | `PublicKey`, `getBinIdFromPrice`, `getConnection`, `log`, `config.tokens.SOL` | `@solana/web3.js`, lokal `dlmm.js`, `logger.js`, `config.js` | Ada |
| C | `trackTxGas` | `gas-tracker.js` | Ada sebagai drop-in Stage 2; byte-identik fork, SHA-256 `b941c3e5058f9cad8b8ec735702c04f9a24415dbd0e7eec6ed55afee9fb9dbbf` |
| C | `sendAndConfirmTransaction`, `getConnection` | `@solana/web3.js`, lokal `dlmm.js` | Ada; wrapper hanya mengganti delapan call-site fork |
| D | `config.api.lpAgentRelayEnabled`, `log` | `config.js`, `logger.js` | Ada |
| D | `Date`, `Number` dan `error.status` | global/runtime dan object error relay | Ada/tidak memerlukan modul baru |
| E | `getCandidateMomentum`, `getSmartWalletMomentum` | `candidate-memory.js` | Ada sebagai drop-in Stage 2; byte-identik fork, SHA-256 `230da728d6ded99d30004f959acf7ef8c4bd6f9f2b73ef3f02bd8cd964535866` |
| E | `getAndClearStagedSignals` | `signal-tracker.js` | Export ada di baseline vanilla |
| E | `appendDecision` | `decision-log.js` | Export/import sudah ada |
| E | `recordPerformance` | `lessons.js` | Ada; menerima object terbuka dan menyimpan `...perf`, tanpa schema whitelist/strict; field tambahan `narrative_category`, `deployed_at`, `active_setup`, `profile`, dan `shadow_signals` diterima |
| E | `resolvePerformanceSignalSnapshot`, `trackPosition`, `config.darwin`, `log` | lokal `dlmm.js`, `state.js`, `config.js`, `logger.js` | Ada |
| F | `trackPosition`, `setPositionInstruction` | `state.js` | Keduanya ada; `setPositionInstruction` diekspor sandbox |
| F | `swapToken`, `config.tokens.SOL` | `tools/wallet.js`, `config.js` | Ada; `swapToken` memerlukan perluasan import bersama kategori B |
| F | `newPosition`, `positionCreated`, `pool`, `activeBin`, `finalAmountX/Y` | lokal blok deploy | Deklarasi lokal tersedia pada anchor fork/vanilla |
| G+I | `ensureDeployedAt` | `state.js` fork | **ABSEN** dari vanilla/sandbox `state.js`; wilayah state dikunci untuk 7.8/7.9 |
| G+I | `resolveDisplayPair`, `firstResolvedName` | `tools/pnl.js` fork | **ABSEN** dari export `tools/pnl.js` vanilla/sandbox; import verbatim akan gagal |
| G+I | `computePositions`, `fetchDlmmPnlForPool` | `tools/pnl.js` | Export/import sudah ada |
| G+I | `PublicKey`, `getConnection`, `safeNum`, `maybeNum`, `roundNum`, `config`, `log` | `@solana/web3.js`, lokal `dlmm.js`, `config.js`, `logger.js` | Ada |
| G+I | `AbortController`, `URLSearchParams`, `fetch`, `Date`, `Math`, `Number` | global Node/runtime | Ada |
| G+I | `close_reason` | field return/local `reason` | Tidak membutuhkan dependensi baru |

Tidak ada salinan Stage 2 yang diperlukan: `gas-tracker.js` dan
`candidate-memory.js` sudah ada di pack dan sandbox serta byte-identik dengan
fork. Kategori H (`F9-light` dan import `estimateGasSol` via `reports.js`) tidak
disentuh; shim gas-est warisan 6.2 tetap utuh.

## STOP-LAPOR

F2-F7 tidak dijalankan karena patch verbatim dan gate yang diminta bergantung
pada identifier yang absen:

1. Kategori B tidak dapat dinyalakan karena `config.js` vanilla tidak membentuk
   empat field `dualSide*`. Opsi owner: izinkan patch konfigurasi fork dalam
   scope 6.3, atau tentukan wiring config lain yang menjadi sumber nilai.
2. Butir I `deployed_at` membutuhkan `ensureDeployedAt`. Sesuai brief, fungsi
   tidak ditambahkan ke `state.js`. Opsi owner: keluarkan hanya butir ini dari
   20e, atau izinkan pemilik wilayah 7.8/7.9 memasangnya lebih dulu.
3. Logging fallback G memakai `resolveDisplayPair` dan `firstResolvedName`, tetapi
   keduanya absen dari `tools/pnl.js`. Opsi owner: izinkan ekstraksi helper fork
   ke wilayah `tools/pnl.js`, atau keluarkan empat pemakaian helper itu dari 20e.

Pack selain file progress ini dan sandbox tidak diubah pada F1. Tidak ada patch
20a-20e, manifest update, install/uninstall, atau transaksi yang dijalankan.
