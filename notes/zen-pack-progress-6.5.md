# Zen Pack 6.5 — lessons.js lapisan tulis

Sumber kebenaran: committed fork `experimental@643e954`, dibaca dengan
`git show` dari `/home/ubuntu/meridianzen`. Bot live tidak disentuh; target uji
hanya `/home/ubuntu/meridian-lab/vanilla-test`.

## Progress

- ✅ F0 — pre-flight
- ✅ F1 — recon OLD/NEW presisi
- ⬜ F2 — Patch 25a W1+W2
- ⬜ F3 — Patch 25b W3+W4
- ⬜ F4 — Patch 25c W5+W6+W7+W8
- ⬜ F5 — gate money penuh
- ⬜ F6 — manifest + tutup

## F0 — bukti satu baris

`pack HEAD=5c06393 clean; sandbox HEAD=5ab14b4 post-6.4; node --check lessons.js PASS`

## F1 — verdict

Seluruh W1–W8 ada dan cocok konten; tidak ada dependensi absen atau pola OLD
ambigu. Kutipan exact OLD/NEW, peta konsumen W2, dan analisis penghapusan W4 ada
di `notes/lessons-write-6.5-recon.md`. Pekerjaan boleh lanjut ke F2.

