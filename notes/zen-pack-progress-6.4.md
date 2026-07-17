# Zen Pack 6.4 — lessons read layer, reports, close display

Sumber kebenaran: committed fork `experimental@643e954` dari
`zenzen-netizen/zenmerimerizen`, dibaca dengan `git show`. Working tree
`fork-ref/` tidak dipakai. Bot live tidak disentuh.

## Progress

- ✅ F0 — pre-flight
- ✅ F1 — inventaris dependensi
- ✅ F2 — Patch 21 lessons lapisan baca
- ✅ F3 — reports.js drop-in + smoke import
- ✅ F4 — repoint gas-est + hapus shim + manifest
- ✅ F5 — Patch 22 kategori H dlmm
- ✅ F6 — Patch 23 telegram/render + Patch 24 prompt
- ✅ F7 — gate lengkap
- ✅ F8 — manifest + tutup

## F0 — bukti satu baris

`pack HEAD=3642527 clean; sandbox post-6.3; node --check lessons.js tools/dlmm.js telegram.js briefing.js = PASS`

## F1 — inventaris dependensi

### lessons.js lapisan baca

| Identifier eksternal | Sumber | Status sandbox/pack |
|---|---|---|
| `fs` | stdlib `fs` | sudah di-import lessons.js |
| `log` | `logger.js` | sudah di-import lessons.js |
| `paths.lessonsPath`, `paths.lessonsArchivePath` | `paths.js` | routing hidup via Patch 02; `lessonsPath` dan `lessonsArchivePath` tersedia |
| `config.activeSetup` | `config.js` | binding hidup via Patch 04a; dipertahankan di rumah patch, tidak membuat import top-level fork baru |
| `isPaperMode` | `paper-trading.js` | binding hidup via Patch 04a; dipertahankan di rumah patch. Scope negatif 6.5 tidak dipindah/ditambah ke import top-level |
| `isFiniteNum`, `load` | lokal lessons.js | tersedia |

Muatan Patch 21: perluasan enam `PERFORMANCE_SIGNAL_FIELDS`; flag `full` pada
`listLessons`; blok read-layer fork dari `keepActiveRacikan` sampai
`getNarrativeProfileForPrompt`, termasuk ROI `getPerformanceSummary`. Hunk
write-layer `recordPerformance`, `derivLesson`/`evolveThresholds`, dedup
`addLesson`, paper-filter `getLessonsForPrompt`, dan marker `fmt` tetap 6.5.

### reports.js

Semua import fork (daftar lengkap):

| Import | Status |
|---|---|
| `{ config }` dari `./config.js` | ada |
| `{ getHourlyProfile, classifySession, getNarrativeProfile, classifyNarrative, sessionLabel }` dari `./lessons.js` | lima fungsi tersedia setelah Patch 21 |
| `{ SEP, tree }` dari `./views/format.js` | drop-in Stage 2 ada; export terverifikasi |

Tidak ada import lain. `plugins/reports.js` sudah byte-identik fork (SHA-256
`23b792d8129e438ae64e3dc91b568cef02791e37b897eb52c07768fc4c4de8f9`), tetapi
belum bootable sebelum Patch 21; F3 mengaktifkan dan menguji rantainya.

### Konsumen telegram/display

| Muatan | Fork | Sandbox/rumah pack |
|---|---|---|
| `estimateGasSol` import | `telegram.js:5` | import belum ada; Patch 18 imports snippet |
| `notifyClose` gas | `telegram.js:601` | sandbox `telegram.js:602` masih `const gasSol = null`; Patch 18 notify snippet |
| `/status` Realized `pnlBlock` | `index.js:3175` (juga jalur `:3212`, `:3695`) | handler aktif ada di `zenpack-plugins/30-render-views.js`; `pnlBlock: null` sekitar baris 367 |
| `/wallet` Realized `pnlBlock` | view-model fork pada rantai index yang sama | handler aktif ada di plugin 30; `pnlBlock: null` sekitar baris 391 |

`formatPnlTracker` berasal dari `pnl-tracker.js` dan transitif memakai
`GAS_EST_SOL` dari `reports.js`; setelah F3 rantai ini utuh. Patch 23 dipasang di
Patch 18 + plugin 30, bukan membuat handler Telegram baru.

### Rumah prompt

Core `prompt.js` sengaja tidak disentuh. Rumah existing adalah
`zenpack-plugins/40-prompt-racikan.js`, post-transform melalui Patch 05
`prompt:build`. Fork menyisipkan `getTimeProfileForPrompt()` dan gated
`getNarrativeProfileForPrompt()` di cabang SCREENER (`prompt.js:110-157`). Patch
24 menambah import lessons dan transform pada anchor SCREENER existing di plugin
40; tidak membuat jalur prompt baru.

### Verdict STOP

Tidak ada dependensi absen tak terduga; pekerjaan boleh lanjut ke F2.

## F7 — gate

- Syntax: `node --check` PASS untuk `lessons.js`, `reports.js`,
  `tools/dlmm.js`, `telegram.js`, `prompt.js`, plugin 30, dan plugin 40.
- Siklus: uninstall seluruh file patched `verify: clean`; setelah `git clean -fd`
  sandbox porcelain 0; fresh install PASS; install kedua Patch 21 (3/3), Patch 22
  (4/4), Patch 23 (2/2) seluruhnya `skipped-idempotent`. Shim
  `zenpack-lib/gas-est.js` tidak ada.
- Harness pasca-reinstall: agent constants 8, agentloop 14, config 15,
  definitions 4, DLMM-PAPER 6/6, executor-exit 10, executor-ext 13,
  sizing 14, hooks 8, patcher 15, paths 12, profile-tools 10,
  prompt parity 8, screening 4, SMI 4, Telegram 19/19 + ext 5/5, wallet
  5, reports smoke, lessons read fixture, dan smoke v0.2 semuanya hijau.
- LAPIS dual-side tetap `diff: []`, flag-ON shape hidup, ZERO-TX 0.
- Read-layer fixture: 17 function export tersedia; empty `performance: []`,
  record lama tanpa `active_setup`/session/narrative, dan delapan record sintetis
  seluruhnya aman. ROI, hourly, narrative, time/narrative prompt masuk akal.
- Kategori H/notif close: Patch 22 return relay+lokal byte-verbatim fork; executor
  memetakan `recorded_pnl_*`, peak, fee, reason, lesson. Stub DRY_RUN Telegram
  menghasilkan Net PnL, Fee panen, Give-back, Lesson, dan `Gas ~0.00006 SOL`.
- Golden read-only: `reports.js` SHA-256 target=fork
  `23b792d8129e438ae64e3dc91b568cef02791e37b897eb52c07768fc4c4de8f9`;
  snip21 signal/list/read dan snip22 relay/local cocok sumber `git show`; prompt
  post-transform 8/8 parity; Telegram full-file hanya beda marker/routing import.

### Raw diff classification — sapu-tuntas

`tools/dlmm.js` menghasilkan 11 unified hunks; seluruhnya masuk daftar baru:

1. marker zen-pack (allow-list; replacement exact saat ini tidak menambah hunk
   semantik),
2. `ensureDeployedAt` import/call — utang state 7.8/7.9,
3. baseline transport delta `agent-meridian.js` shim (termasuk helper/call relay
   dan fallback relay untracked yang satu blok),
4. baseline transport delta fallback `ix.accountKeyIndexes || ix.accounts || []`,
5. baseline transport delta komentar zap-in relay disabled,
6. baseline transport delta fallback dynamic `node-fetch` pada exit detail.

Import shim gas-est dan kategori H tidak lagi muncul sebagai pengecualian.
Tidak ada hunk dlmm tak terklasifikasi.

`lessons.js` menghasilkan 14 unified hunks: marker/routing + relokasi blok read
Patch 03a/04a/21, serta write-layer 6.5 yang dilarang brief ini
(`recordPerformance` suspect/paper tagging/time fields/hive/evolve,
`derivLesson`/`evolveThresholds` isolation dan helper cleanup, `addLesson` dedup,
writer `removeLesson`, `getLessonsForPrompt` paper/suspect filter, marker sim di
`fmt`). Tidak ada hunk lessons tak terklasifikasi. Empat hunk sisa `tools/pnl.js`
tetap propagasi Jupiter display di luar scope dan tidak disentuh.
