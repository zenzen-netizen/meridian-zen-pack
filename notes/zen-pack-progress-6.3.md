# Progress 6.3 - dlmm.js custom non-paper

- ✅ F0 - Pre-flight
- ✅ F1 - Inventaris dependensi; STOP-LAPOR (3 dependensi absen)
- ✅ F2 - Config plugin 50 + patch 20a dual-side + restore `!dualSide`
- ✅ F3 - Patch 20b: `sendTxTracked`
- ✅ F4 - Patch 20c: relay circuit breaker
- ✅ F5 - Patch 20d/20f/20e: shadow, helper pnl, cleanup, rent, logging
- ✅ F6 - Gate lengkap; raw diff habis terklasifikasi
- ✅ F7 - Manifest + tutup

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

## STOP-LAPOR F1 (historis; dibuka addendum owner)

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

## Keputusan owner dan implementasi F2-F5

- `dualSide*` diizinkan melalui plugin 50; default OFF dan nilai user-config
  memakai empat nilai fork. Config-ext 15/15.
- `ensureDeployedAt`/backfill `deployed_at` dikeluarkan dari 20e dan tetap utang
  7.8/7.9; `state.js` tidak ditambah fungsi tersebut.
- Enam helper display `tools/pnl.js` dipasang lebih dahulu lewat 20f; hanya
  pemakaian G pada row posisi dan I pada final close tanpa tracked yang dipasang.
  Dua pemakaian dalam kategori H tetap tidak disentuh.
- 20a memulihkan `!dualSide`, menghapus marker utang 6.2, dan memasang transform,
  shape, pre-swap, strategy/percentX. 20b menghasilkan satu wrapper + tujuh
  call-site (delapan kemunculan `sendTxTracked(` seperti fork). 20c memasang
  circuit + failure hook. 20d memasang shadow/narrative fields. 20e memasang
  cleanup orphan/dual-side, signal fallback, retry 8s, PnL sanity, rent fallback,
  dan final `close_reason`.

Commit sub-fase:

1. `3043824 feat(6.3): dual-side config keys via plugin 50`
2. `cac3628 feat(6.3): patch 20a DLMM dual-side deploy`
3. `c557f35 feat(6.3): patch 20b DLMM gas tracking`
4. `5d33a60 feat(6.3): patch 20c relay circuit breaker`
5. `31dd841 feat(6.3): patch 20d DLMM shadow learning`
6. `0df76dc feat(6.3): patch 20f PnL display helpers`
7. `b21ea83 feat(6.3): patch 20e DLMM cleanup and rent safety`
8. `1a687e2 test(6.3): cover dual-side dry-run parity`

## F6 - Bukti gate yang lulus

- `node --check`: plugin 50, patch 20a-20f, test, target `tools/dlmm.js`, dan
  target `tools/pnl.js` PASS.
- Idempotensi fresh reinstall: seluruh operasi patch `skipped-idempotent` pada
  install kedua.
- Siklus uninstall: seluruh file patch `verify: clean`; `git status --porcelain`
  kosong; reset memakai `git clean -fd`; reinstall vanilla-murni sukses.
- Dual-side LAPIS 1 OFF: output baseline/patched identik, `diff: []`.
- Dual-side LAPIS 2 ON + DRY_RUN: `bins_above=165`, shape `amount_x=0` dan
  `amount_y=0.5`, branch strategy/percentX exact fork, `ZERO-TX=0`.
- DLMM-PAPER 6/6; Telegram 19/19 + ext 5/5; harness penuh hijau: smoke,
  agent 8, agentloop 14, config 15, definitions 4, executor 10+13+14, paths 12,
  profile 10, prompt 8, screening 4, SMI 4, wallet 5.
- Rent fallback runtime 3/3 dan helper pnl runtime 4/4.
- Golden content: seluruh 25 snippet NEW 20a-20f ditemukan verbatim di committed
  fork (indentasi dinormalisasi hanya untuk blok relay yang nesting vanilla-nya
  berbeda). Kategori H dibuktikan tetap tanpa `F9-light`/`recorded_pnl_*`.

## STOP-LAPOR F6 - kontrak raw diff

Raw full-file `tools/dlmm.js` belum memenuhi daftar pengecualian addendum. Selain
shim gas-est, kategori H, dan backfill `ensureDeployedAt`, masih ada delta baseline
vanilla pra-6.3 berikut:

1. Vanilla memakai import/drop-in `tools/agent-meridian.js`; fork committed
   mendefinisikan sekitar 100 baris `getMeridian*`/retry/fetch lokal dan memakai
   helper lokal pada zap-in, raw-position, serta zap-out.
2. Vanilla mempertahankan fallback aman
   `ix.accountKeyIndexes || ix.accounts || []`; fork hanya membaca
   `ix.accountKeyIndexes`.
3. Komentar vanilla bahwa zap-in relay sengaja disabled tidak ada di fork.

Delta transport/safety ini sudah ada sebelum 6.3, tidak termasuk enam kategori
yang diotorisasi, dan menghapusnya akan memperluas scope sekaligus menurunkan
defensive compatibility vanilla. Karena itu F7/manifest belum dijalankan.

Opsi owner: (a) tambahkan tiga delta baseline tersebut ke pengecualian raw diff
(rekomendasi; tidak mengubah money path yang telah digate), atau (b) otorisasi
patch baru yang mengganti shim transport vanilla dengan implementasi lokal fork
dan menghapus fallback instruction-key.

## Keputusan owner final + sapu-tuntas raw diff

Owner memilih opsi (a), lalu mengesahkan fallback dinamis `node-fetch` sebagai
baseline transport delta keempat. Tidak ada kode runtime yang diubah.

Audit full-file sekali jalan memakai raw diff dan pass `-w`:

- `tools/dlmm.js`: 16 hunk semantik seluruhnya terpetakan ke import shim gas-est,
  kategori H, `ensureDeployedAt` backfill, atau empat baseline transport delta
  (shim agent-meridian, fallback instruction keys, komentar relay-disabled, dan
  fallback node-fetch). Kandidat delta baru: **0**.
- `tools/pnl.js`: blok enam helper 20f identik fork. Empat hunk sisa seluruhnya
  adalah propagasi Jupiter symbol/display F6 lain yang addendum owner eksplisit
  larang ikut karena di luar scope. Kandidat delta baru: **0**.

Manifest dinaikkan ke 6.3, patch 20a-20f dicatat, config keys plugin 50 dicatat,
utang `dual_side_restore` dihapus sebagai LUNAS, H tetap 6.4/6.5, dan
`ensureDeployedAt/deployed_at` digabung ke utang 7.8/7.9.
