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

# Stage 3.1 — 01-hook-bus.patch + boot DRY_RUN

✅ Fase 0 verifikasi: pack HEAD 2a915fb, vanilla 5ab14b4, anchor baris 1 persis.
   DEVIASI: vanilla-test/ hilang (sesi lalu tak persist) → direkonstruksi via cp -a dari vanilla pristine (SHA sama, porcelain 0, anchor cocok).
   Temuan: install.sh SUDAH salin lib/ → zenpack-lib/ (bukan zenpack/lib/ spt sketsa brief) → Fase 2 tinggal verifikasi siklus; patch import pakai ./zenpack-lib/loader.js.
   Kontrak loader: loadPlugins(pluginsDir, hooks) async → {loaded,skipped,errors}; hooks = namespace import lib/hooks.js.
✅ Fase 1 .env dummy: boot DRY_RUN lolos config load; cron start; baseline error = "401 Missing Authentication header" (LLM call, wajar). Fixture: tests/fixtures/env.dummy.
   Var final: DRY_RUN, WALLET_PRIVATE_KEY (palsu base58 64-byte), RPC_URL (publik), OPENROUTER_API_KEY (dummy), TELEGRAM_* kosong, LOG_LEVEL.
   Catatan: package-lock.json vanilla desync upstream → npm ci gagal; pakai npm install + git checkout package-lock.json (porcelain 0).
✅ Fase 2 zenpack-lib/: SUDAH dikirim install.sh sejak Stage 2 (copy_dir lib zenpack-lib). Siklus install→uninstall(porcelain 0)→install terbukti. Nol perubahan kode.
✅ Fase 3 plugins/00-zenpack-hello.js: register(hooks) + manifest.priority 10. node --check OK, loader.test.mjs fail 0.
