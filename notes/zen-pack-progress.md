# Zen-Pack Stage 1 Progress

✅ 1.1 repo + skeleton folder
✅ 1.2 lib/hooks.js + test (8/8 lulus)
✅ 1.3 lib/patcher.js + test (6/6 lulus)
✅ 1.4 lib/loader.js + test (loaded urut prioritas, non-plugin di-skip, errors 0)
✅ 1.5 install.sh + uninstall.sh v0 (smoke di vanilla-test: install OK, uninstall porcelain KOSONG)
✅ 1.6 manifest.json v0 + tests/smoke-test.js (npm test: SMOKE v0: PASS)

# Stage 2 — Drop-in pure-add

✅ 2.0 verifikasi daftar drop-in vs diff live (34/34 cocok persis; SETTINGS-GUIDE.md satu-satunya doc pure-add)
✅ 2.1 salin 18 top-level → plugins/ (18 file, node --check nol fail)
✅ 2.2 salin 12 views → views/ (12 file, node --check nol fail)
✅ 2.3 salin 1 tools + 3 scripts (node --check nol fail)
✅ 2.4 docs/SETTINGS-GUIDE.md + manifest stage:2 + drop_ins
✅ 2.5 smoke v0.2 PASS + install/uninstall vanilla-test (0 modified, 9 entri baru; uninstall porcelain 0)
