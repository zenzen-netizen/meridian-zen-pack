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
- ⬜ F6 — Patch 23 telegram/render + Patch 24 prompt
- ⬜ F7 — gate lengkap
- ⬜ F8 — manifest + tutup

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
