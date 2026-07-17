# Zen Pack 6.5 — lessons.js lapisan tulis

Sumber kebenaran: committed fork `experimental@643e954`, dibaca dengan
`git show` dari `/home/ubuntu/meridianzen`. Bot live tidak disentuh; target uji
hanya `/home/ubuntu/meridian-lab/vanilla-test`.

## Progress

- ✅ F0 — pre-flight
- ✅ F1 — recon OLD/NEW presisi
- ✅ F2 — Patch 25a W1+W2
- ✅ F3 — Patch 25b W3+W4
- ✅ F4 — Patch 25c W5+W6+W7+W8
- ✅ F5 — gate money penuh
- ✅ F6 — manifest + tutup

## F0 — bukti satu baris

`pack HEAD=5c06393 clean; sandbox HEAD=5ab14b4 post-6.4; node --check lessons.js PASS`

## F1 — verdict

Seluruh W1–W8 ada dan cocok konten; tidak ada dependensi absen atau pola OLD
ambigu. Kutipan exact OLD/NEW, peta konsumen W2, dan analisis penghapusan W4 ada
di `notes/lessons-write-6.5-recon.md`. Pekerjaan boleh lanjut ke F2.

## F5 — gate

- Syntax: `node --check` PASS untuk Patch 25a/25b/25c, test write-layer, dan
  target `lessons.js`; smoke pack juga memeriksa seluruh lib/plugin/view/tool.
- Siklus: uninstall memulihkan semua target dengan `verify: clean`, porcelain
  kosong; `git clean -fd` membuang artefak preset; fresh install PASS; install
  kedua membuat 2+4+4 operasi Patch 25a–c seluruhnya `skipped-idempotent`.
- Evolve dua lapis: lima close paper menjaga `user-config.json` dan
  `signal-weights.json` byte-sama; lima close live mengubah threshold fork
  `minFeeActiveTvlRatio 0.05→0.06`, menulis lesson AUTO-EVOLVED, dan mengubah
  bobot Darwin (`organic_score 1→1.05`, `volatility 1→0.95`).
- Suspect: close sintetis −95% non-stop-loss pada $100 disimpan dengan
  `suspect_pnl:true` dan reason exact fork; −95% dengan reason `stop loss` serta
  −50% tidak ditandai; `getSuspectCount()` menghasilkan 1.
- Writer/prompt: aturan identik dua kali tersimpan satu (pinned ter-refresh),
  `removeLesson` menghapus tepat satu ID; lesson paper terlihat saat DRY_RUN,
  hilang live default, dan muncul lagi dengan marker 🧪 saat opt-in.
- Regresi: seluruh `.mjs` harness hijau; prompt parity 8/8 terhadap archive
  commit `643e954`; Telegram 19/19 + ext 5/5; DLMM-PAPER 6/6; dual-side OFF
  before/after `diff: []`, ON hidup, ZERO-TX 0; smoke v0.2 PASS.
- Golden read-only: SHA-256 wilayah `recordPerformance`, `evolveThresholds`, dan
  gabungan `addLesson`→`fmt` masing-masing identik fork. Raw diff `lessons.js`
  tinggal empat hunk non-semantik: marker paths, relokasi binding/time helpers
  rumah Patch 04a/21, marker deletion W4, dan marker read-layer. Hunk custom
  write-layer tersisa = 0. `tools/pnl.js` tetap empat hunk display yang dikunci
  scope negatif dan tidak disentuh.

## F6 — manifest + tutup

- Manifest naik ke Stage 6.5 dan mencatat Patch 21–23 yang sudah hidup serta
  Patch 25a–c.
- Utang `lessons write-layer` dinyatakan LUNAS; pengecualian raw lessons tinggal
  marker/routing/relokasi rumah Patch 04a/21, tanpa delta semantik.
- Commit per sub-fase: `5350cb4` recon, `8af0700` Patch 25a, `40083f3` Patch
  25b, `00e6d0b` Patch 25c, `278d94b` gate fixture, lalu commit penutup
  manifest/progress.
