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
✅ Fase 4 patch 01-hook-bus: core-patches/{01-hook-bus.mjs,apply.mjs,revert.mjs} + integrasi install.sh/uninstall.sh. Apply via lib/patcher.js (backup+hash+auto-rollback). Install 2x = skipped-idempotent. node --check OK. Backup .zenpack/backups/index.js.orig + hash tercatat.
✅ Fase 5 boot terpatch: "[zen-pack] loaded 1 plugins (skipped 2, errors 16)" + "hello plugin registered" SEBELUM baseline 401. Siklus uninstall (restore+verify clean, hash cocok, porcelain 0) → reinstall → boot ulang OK.
   ⚠️ DEVIASI TERBUKA: 16 drop-in Stage 2 error saat di-import loader — relative import mereka ("./repo-root.js" dll) mengira file di repo root, padahal drop-in di plugins/. Non-fatal (loader catch per-file), boot & baseline tak berubah. Butuh keputusan Zen: pisahkan dir hook-plugin dari dir drop-in (mis. patch tunjuk zenpack-plugins/), ATAU tulis ulang import drop-in saat Stage berikutnya (wiring). 2 skipped = paths.js? (import OK tanpa register).

# Stage 3.1b — layout A+ (mirror fork + dir loader terpisah)

✅ Fase 0: HEAD da9c1fe, branch main, vanilla-test ada (masih terpasang → uninstall dulu, porcelain 0). Tabrakan: NOL (18 drop-in vs root, views/ tak ada di vanilla, tools/smi.js kosong). Mapping lama install.sh:38-48 tercatat.
✅ Fase 1 mapping A+: plugins/->root, views/->views/, tools-extra/->tools/, +zenpack-plugins/; cek pure-add via cmp (identik=milik kita/idempotent, beda=STOP); uninstall dir-cleanup ikut; manifest.json stage 3.1. bash -n + json OK.
✅ Fase 2: zenpack-plugins/ (git mv hello), install.sh sudah salin (Fase 1), patch 01-hook-bus tunjuk ./zenpack-plugins. loader.test hijau.
✅ Fase 3 gerbang: boot "[zen-pack] loaded 1 plugins (skipped 0, errors 0)" + hello SEBELUM baseline 401 (identik 3.1). Fisik: 18 root + 12 views/ + tools/smi.js + zenpack-plugins/hello (manifest 39 entri). Uninstall: restore verify clean + porcelain 0 (root/views/tools bersih). Install 2x idempotent (skipped-idempotent, cmp lolos). smoke-test disesuaikan key A+ -> SMOKE v0.2 PASS. Nol isi drop-in diedit (diff stat: hanya install/uninstall/manifest/patch/smoke + rename hello).

# Stage 3.2 — 02-paths-routing

✅ Fase 0: HEAD 332246f; vanilla-test masih terpasang → uninstall (verify clean, porcelain 0). Recon live: 19 titik [A] + [B] persis peta brief, NOL titik baru. paths.js drop-in punya SEMUA key [A] (userConfigPath..logDir). lib/patcher.js belum punya replace-op → Fase 1 dibuat.
✅ Fase 1 replaceLine di lib/patcher.js: exact-match OLD (unik: 0=old-not-found, >1=old-not-unique), idempotent (NEW ada+OLD hilang=skipped), backup+hash, node --check auto-rollback. Test patcher 11/11.
✅ Fase 2 batch 1 (11 file data murni, 15 replace + 11 inject import): apply via replaceLine/applyPatch, semua replaced/patched, node --check 11/11, boot: loader errors 0 + baseline 401 identik. apply.mjs diperluas (format array + replaces[]).
✅ Fase 3 batch 2 (config.js x2, telegram.js, tools/executor.js, index.js:1992 inline): replaced semua, node --check OK, boot loader errors 0 + baseline 401 identik. Install 2x = full skipped-idempotent.
✅ Fase 4 gerbang: PARITAS 12/12 (paths.* == repoPath lama tanpa env). ISOLASI: MERIDIAN_DATA_DIR=profiles/testprofil -> state/decision-log/strategy-library/hivemind-cache/logs tercipta di profil, root mtime TAK berubah; .env root tetap dibaca (DRY RUN aktif); model ganti krn user-config profil terbaca = bukti routing. Boot normal: baseline 401 identik, errors 0. FIX: revert.mjs diajari format array multi-file (file ganda 01+02 restore sekali via seen-set). Siklus: uninstall 15 file restored+clean, porcelain 0, reinstall+boot OK. npm test PASS.

# Stage 3.3 — wiring Telegram batch 1 (/addprofil + /export)

✅ Fase 0: HEAD 3a1ea57; vanilla-test di-uninstall (15 clean, porcelain 0). Anchor `/briefing` UNIK (index.js:1415 vanilla). load() vanilla return {lessons:[],performance:[]} ✓. Binding hooks patch 01 = `__zenpackHooks` (namespace import, punya .run). Sumber fork: lessons.js getPerformanceForRacikan+listRacikanInPerformance (~:937-954), wrapper index.js exportUsageText:2788 runExportCommand:2803 runAddProfilCommand:2853, dispatch :3242-3252 — cocok kutipan brief.
✅ Fase 1 patch 03a: op appendPatch di patcher (marker EOF, idempotent, rollback; test 14/14) + core-patches/03a (2 fungsi VERBATIM fork lessons.js:931-954, byte-identik terverifikasi). FIX: regex runner ^\d\d- tak kenal "03a-" -> ^\d\d[a-z]?- (apply+revert). Boot: errors 0 + 401 baseline. Install 2x idempotent. INSIDEN 2x: commit sempat nyasar ke repo vanilla-test (cwd salah) -> git reset 5ab14b4, nol jejak, tak pernah ter-push.
✅ Fase 2 zenpack-plugins/10-telegram-cmds.js: wrapper VERBATIM fork (exportUsageText/runExportCommand/runAddProfilCommand), adaptasi hanya reply/handled/path import. Match command persis pola fork. node --check + loader test hijau.
✅ Fase 3 patch 03b: replaceLine sisip blok hook telegram:command SEBELUM anchor /briefing (binding __zenpackHooks patch 01, reply via sendMessage). replaceLine dipertegas: cek NEW-terpasang SEBELUM cek OLD (NEW mengandung OLD). Boot: loaded 2 plugins errors 0. INSIDEN+FIX install.sh: install-gagal-tabrakan sempat truncate manifest -> uninstall buta (orphan 26; dibersihkan git clean -fd, .env/logs aman). Fix: manifest tak lagi di-truncate (touch+append dedupe) + file tercatat manifest = milik kita (boleh timpa saat upgrade). Install 2x OK, manifest nol duplikat.
✅ Fase 4 gerbang: test hook 5/5 (usage, scaffold profiles/sandboxprofil [.env.template, ECOSYSTEM-SNIPPET.txt, RESTORE.txt, presets, user-config.json], exports/profil_*, racikan kosong graceful via 03a, /status TIDAK handled). Boot penuh: loaded 2 errors 0 + baseline 401 identik. Regression revert multi-patch (01+02+03a+03b): 16 file restored+clean, porcelain 0. Reinstall+boot OK. Artefak test profiles/ exports/ dibersihkan sebelum cek porcelain. manifest stage 3.3. npm test PASS.

# Stage 3.4 — wiring /preset family (plugin-only, tanpa patch baru)

✅ Fase 0: HEAD 09a6516; vanilla-test masih terpasang 3.3 → uninstall (16 file restored+clean, porcelain 0). Sumber fork-ref cocok kutipan: presetUsageText index.js:2708-2720, runPresetCommand :2722-2788, underPm2 :2888-2890, finishPresetApply :2893-2900, dispatch telegram :3236-3240 (res.applied → await finishPresetApply({viaTelegram:true})). formatIdentity TIDAK dipakai wrapper preset (hanya identity views :324/:344/:358/:1719) → tidak diimport. Drop-in preset-manager.js sadar-profil terkonfirmasi (:24-25 paths.presetsDir/userConfigPath), semua export wrapper ada.
✅ Fase 1: zenpack-plugins/10-telegram-cmds.js diperluas cabang /preset — presetUsageText/runPresetCommand/underPm2/finishPresetApply VERBATIM fork (:2708-2788, :2888-2900); adaptasi hanya reply/handled + finishPresetApply terima `reply` argumen (pengganti sendMessage). Alur applied:true → await finishPresetApply dipertahankan. Import preset-manager diperluas (8 fungsi; formatIdentity tak dipakai → tak diimport). node --check OK, loader test + smoke PASS. Nol patch baru, drop-in tak diedit.
✅ Fase 2 gerbang: tests/telegram-cmds.test.mjs diperluas 7 assert /preset → 12/12 lolos (list kosong graceful, save→presets/sandboxset.json, show identik, use→_backup.json + instruksi restart manual non-pm2 + proses TIDAK exit, rm terhapus, sub tak dikenal→usage, /screen TIDAK handled). Bonus isolasi: MERIDIAN_DATA_DIR=profiles/sandboxprofil → /preset save isoset tercipta di profiles/sandboxprofil/presets/, BUKAN root (sadar-profil end-to-end). Boot penuh: loaded 2 plugins errors 0 + baseline 401 identik. Catatan: savePreset menulis user-config.json (stamp activeSetup) → gerbang backup/restore user-config.json (gitignored) di sekitar test. Artefak (profiles/exports/presets) dibersihkan → uninstall restore clean porcelain 0 → reinstall+boot OK. npm test PASS.

# Stage 3.7 — render views batch 2: /wallet + /config + /pool (plugin-only, nol patch baru) + klarifikasi 3.6

✅ Fase 0 — KLARIFIKASI 3.6 (dua isu, tuntas sebelum kerja baru):
   KLAR1 (kontradiksi getModePerformance): laporan 3.5 BENAR, 3.6 SALAH. getModePerformance ADA di vanilla-test lessons.js:829 (di dalam marker zen-pack:04a 783-945, port 04a). Laporan 3.6 "absen vanilla+pack" keliru. TAPI outcome tunda pnlBlock 3.6 tetap BENAR — alasan dikoreksi: formatPnlTracker (pnl-tracker.js drop-in) transitif import reports.js, dan reports.js:16 `import { getHourlyProfile, classifySession, getNarrativeProfile, classifyNarrative, sessionLabel }` — dari 5 itu classifyNarrative/classifySession/sessionLabel TAK diport 04a → rantai putus (`does not provide an export named 'classifyNarrative'`). Jadi pnlBlock TETAP DEFER (reports.js transitif absen), BUKAN karena getModePerformance. Bukti: isolate-import pnl-tracker.js FAIL, sol-tracker.js/preset-manager.js/config-origin.js/views/* OK.
   KLAR2 (misteri "329 closed"): asalnya = ANGKA FIKTIF hardcoded di fixture gate harness (scratch gate.mjs baris `perf.total_positions_closed: 329`) — BUKAN kebocoran data live. Sandbox vanilla-test NOL history. Verifikasi lengkap: lessons.json TAK ADA di vanilla-test/vanilla/fork-ref (find meridian-lab kosong); `.gitignore` vanilla-test:21 = `lessons.json`; `git log --all --oneline -- lessons.json` KOSONG di kedua repo (pack + vanilla-test) → tak pernah commit/push. Data live sebenarnya ada di ~/meridianzen{,2}/ (dir terpisah, bukan sandbox, bukan repo pack). STOP-condition (data live ter-push repo publik) TIDAK terpicu. Gate.mjs 3.7 diberi komentar tegas "329 = fiktif".
   HEAD pack d65bf54 ✅, porcelain 0 ✅.

✅ Fase 1 — recon dep batch 2 (fork-ref sumber port; vonis per item):
   /wallet (fork index.js:3185-3220): getWalletBalances/getMyPositions/computeDeployAmount/config/isHiveMindEnabled ✅vanilla · walletView/render/systemView ✅views · formatSolTracker ✅sol-tracker.js:167 (rantai bersih) → solTracker AKTIF · formatPnlTracker+getModePerformance = pnlBlock DEFER (rantai reports.js putus, lihat KLAR1) · getPositionsRentSol (held) ABSEN (fork tools/dlmm.js:2003, vanilla dlmm.js tak punya — file core) DEFER · buildOpenRouterLines (orLines) index.js-local fork:1669 → tak importable DEFER · racikanScopeDisclosure (disclosure) briefing.js-local (tak export) DEFER.
   /config (fork :3222-3232 → formatCoreConfig/formatFullConfig/formatFunctionConfig index.js:2003-2047, ketiganya delegasi ke configView.buildView+render): data-prep buildConfigRowMap (index.js:1733, ~220 baris, PURE atas config + isHiveMindEnabled) + formatIdentityLines(→formatIdentity preset-manager.js:174 ✅) + activeRacikanName(→getActiveSetupStatus preset-manager.js:158 ✅) + subgroupDesc (pure config) + CORE_GROUPS (config-origin.js:381 ✅ drop-in, BUKAN index.js-local). VONIS: /config LEBIH BERAT dari /wallet /pool (butuh port verbatim ~220-baris buildConfigRowMap + helper) TAPI semua dep importable/degrade-safe (optional-chaining c.reports?/c.experiments?), nol patch baru, nol STOP → tetap plugin-only per pattern 3.6, cuma line-count lebih besar. Vanilla config PUNYA section gmgn/darwin/indicators/strategy (base bot), gmgn.indicatorRules undefined tapi guarded `|| {}`. splitText (fork telegram.js:151) DI-PORT ke plugin: vanilla sendMessage MEN-TRUNCATE `.slice(0,4096)` (bukan split spt fork) → tanpa splitText config >4096 char kepotong. Dead-path: vanilla hanya punya bare `/config` (1464 formatConfigSnapshot); "/config core"+"/config origin" PLUGIN-ADDITIVE (uninstall → unknown, jatuh LLM).
   /pool (fork :3267-3290): getMyPositions/config/poolView/render/systemView ✅ · getTrackedPosition ✅state.js:319 (tapi cuma feed buildRangeEfficiencyLines yang di-DEFER → tak dipakai) · getPositionsRentSol (heldSol) ABSEN DEFER · getSolMarketRegime (solPrice) ABSEN (fork wallet.js:213, vanilla tak punya) DEFER fail-open · buildRangeEfficiencyLines (rangeEffLines) index.js-local fork:1633 DEFER. Vanilla PUNYA /pool (poolMatch 1486) → dead-path terbalik saat uninstall.

✅ Fase 2 — perluas zenpack-plugins/30-render-views.js (satu file, 5 handler): +handleWallet/handleConfig/handlePool; +helper port VERBATIM fork (splitText, buildConfigRowMap, formatIdentityLines, activeRacikanName, subgroupDesc, formatCoreConfig, formatFunctionConfig, formatFullConfig). KOREKSI 3.6: /status pnlBlock tetap null (alasan dikoreksi = reports.js transitif). /wallet solTracker AKTIF, pnlBlock DEFER. buildConfigRowMap+3 formatter di-`export` (loader abai export ekstra) untuk parity golden di gate. node --check OK. Loader loaded 4 errors 0. Commit `feat(plugin): render /config /wallet /pool (batch 2)`.

✅ Fase 3 — gerbang penutup Stage 3: gate harness 3.7 36/36 — hook wiring (/status,/positions,/wallet,/config,/config core,/config origin,/pool 1 = handled true; /help,/settings,/config bogus = false), struktur view /status+/positions (regresi batch 1), /wallet (Wallet+Saldo+Sistem+solTracker embed AKTIF; pnlBlock+held DEFER absen), /pool (header+PnL+Value+identitas; rangeEff+held DEFER absen), PARITY GOLDEN /config: `formatFunctionConfig()` real config vs golden-reference/config.txt = **228 baris == 228 baris**, SEMUA 12 group header golden (📊 Sizing, 🔍 Screening, 🔎 Screening-GMGN, 🚪 Exit, 📐 Strategy, 📊 Indikator, ⏱ Jadwal, 🧠 LLM, 🧬 Darwin, 📑 Reports, 🧪 Eksperimen, 🌐 Sistem) hadir, NOL orphan "Belum terpetakan" (= parity key penuh dgn fork), legenda+footer ada; formatCoreConfig/formatFullConfig header khas ada. tests: telegram-cmds 19/19 (/wallet asersi TIDAK-handled→handled; +/config,/config core,/config origin,/pool 1 handled; +/settings,/config bogus TIDAK-handled), profile-tools 10/10. smoke PASS (zenpack-plugins 4/4 — nol file plugin baru, cuma perluasan). Boot penuh: loaded 4 errors 0 + baseline 401. Siklus uninstall (porcelain 0, "vanilla murni pulih")→reinstall→boot OK. manifest stage 3.7. Nol sentuh bot live.

## Sapu jagat Stage 3 — daftar DEFERRED lintas 3.x (satu tabel)

| Item | Muncul di | Alasan tunda | Target |
|------|-----------|--------------|--------|
| wiring tools/smi.js chart-indicators | 3.5 | pemakainya file core MODIFIED (agent.js SCREENER_TOOLS), bukan patch tipis | Stage 5.8 |
| exposure role SCREENER_TOOLS (get_time/narrative_profile) | 3.5 | vanilla cuma jalur GENERAL fallback; taruh di SCREENER_TOOLS = baris core modified | Stage 5 |
| REPL render (/status dsb non-telegram) | 3.6 | fork index.js:3663 REPL; diluar scope telegram | — (belum dijadwal) |
| getPositionsRentSol (held per-posisi) | 3.6,3.7 (/status,/positions,/wallet,/pool) | ABSEN vanilla dlmm.js (fork-only export, file core) | TBD (butuh port dlmm.js) |
| getSolMarketRegime (solPrice dual-unit) | 3.6,3.7 (/positions,/pool) | ABSEN vanilla wallet.js (fork-only export, file core); fail-open 1-unit | TBD |
| buildOpenRouterLines (orLines) | 3.6,3.7 (/status,/wallet) | index.js-local fork:1669, tak importable plugin | TBD |
| formatPnlTracker+getModePerformance (pnlBlock realized) | 3.6,3.7 (/status,/wallet) | rantai transitif: pnl-tracker.js→reports.js→lessons.js classifyNarrative/classifySession/sessionLabel TAK port 04a | TBD (port 3 fungsi lessons.js) |
| racikanScopeDisclosure (disclosure) | 3.6,3.7 (/status,/wallet) | briefing.js-local, tak di-export | TBD |
| condenseRule (lastGood/Bad Insight) | 3.6 (/status) | index.js-local fork:1696 | TBD |
| buildRangeEfficiencyLines (/pool rangeEff) | 3.7 (/pool) | index.js-local fork:1633 | TBD |
| timeProfile+narrativeProfile prompt (screener) | 4.2 (prompt.js) | dep getTimeProfileForPrompt/getNarrativeProfileForPrompt (fork lessons.js:1123/1215) ABSEN vanilla lessons | Stage 6.4/6.5 |
| /settings menu machine + cfg: callbacks | 3.7 (batch 2 exclusion) | money-adjacent (settings ubah config); butuh state machine + callback wiring | Stage 7.2 |
| docs modified (CLAUDE.md, .env.example, gmgn/user-config.example.json) | 2 | ada di vanilla, bukan pure-add | TBD |
| state.js: milestone + periodic-briefing helpers | 4.3 | additive tapi konsumen (index/briefing custom) belum diport | 6.7 / 7.x |
| state.js: record-shape refactor (makePositionRecord/ensureDeployedAt/recordRebalance + field racikan/trough/price) | 4.3 | konsumen dlmm.js+index.js fork; atribusi racikan nyambung lessons | 6.2/6.3 |
| state.js: mesin peak/exit fork (queue/resolve 15s) vs vanilla 2-tick | 4.3 | money-logic poller. ⚠️ KEPUTUSAN DESAIN 6.2: vanilla e559081 "2-tick confirm" = perbaikan upstream LEBIH BARU dari desain fork — pilih port-fork vs adopsi-vanilla+port-fitur-unik SAAT 6.2, jangan diputus sekarang | 6.2 + 7.8/7.9 |
| pool-memory: getDeployedPoolAddresses | 4.4 | additive; consumer = briefing.js counterfactual skip-review, belum diport | 6.5/6.6 |

# Stage 3.6 — render views batch 1: /status + /positions (plugin-only, nol patch baru)

✅ Fase 0 verifikasi & audit: HEAD pack f479f80; vanilla-test terpasang 3.5 → uninstall (16 file restored+clean, porcelain 0), HEAD 5ab14b4. Hipotesis plugin-only TAHAN: hook 03b anchor `if(text==="/briefing")` di telegramHandler jalan SEBELUM handler /status+/positions vanilla (urutan: /settings 1401 → /briefing 1415 ANCHOR → /wallet||/status 1430 → /positions 1448); hook set handled → patch 03b return sebelum rantai vanilla. Patch 03b TIDAK diubah.
   CARA KIRIM HTML: vanilla telegram.js EXPORT sendHTML (:160) + sendMessage (:147) → plugin import langsung, tak perlu ubah patch 03b (ctx.reply cuma plain sendMessage). Fork: sendHTML utk view, sendMessage utk error/no-positions → ditiru.
   IMPORT MISTERIUS teridentifikasi: views/config.js:22 = penutup multiline `import {...} from "../config-origin.js"`. render.js statis-import view config.js → transitif butuh config-origin.js (drop-in manifest ✅). settings.js/preset-manager.js TIDAK di-load render.js (render hanya import positions/status/wallet/pool/config). format.js self-contained. Graf views/ self-contained kecuali config-origin.js (drop-in ✅).
   KEPUTUSAN /wallet: DILUAR scope batch 1 — view TERPISAH (walletView), handler fork terpisah (:3185) → bukan keluarga /status. Vanilla 1430 `/wallet||/status` tetap layani /wallet (plugin cuma intercept /status; /wallet jatuh ke vanilla).
   AUDIT DEP (vonis per item): getWalletBalances ✅vanilla · getMyPositions ✅vanilla · config/computeDeployAmount ✅vanilla (1-arg; arg ke-2 {slotsRemaining} fork diabaikan JS) · getPerformanceSummary ✅vanilla (roi_pct absen→omit graceful) · isHiveMindEnabled ✅vanilla · render/statusView/positionsView/systemView/ICON ✅views · sendHTML/sendMessage ✅vanilla telegram.js.
   DITUNDA (absen vanilla+pack, fitur belum landing — seksi digerbang null di views, degrade bersih): getPositionsRentSol (held per-posisi /status+/positions) · getSolMarketRegime (solPrice dual-unit /positions → fail-open 1-unit) · buildOpenRouterLines (orLines) · formatPnlTracker+getModePerformance (pnlBlock realized) · racikanScopeDisclosure (disclosure) · condenseRule (lastGood/Bad Insight). /status degrade → Wallet+Performa+Sistem; /positions → semua kecuali held per-posisi (footer total held tetap ◎0.000, unconditional views:99).
✅ Fase 1+2 plugin zenpack-plugins/30-render-views.js (satu file, 2 handler — commit tunggal, deviasi dari brief 2-commit karena file atomik): blok data-fetch VERBATIM fork index.js (/status :3143-3182, /positions :3254-3264) → handler hook telegram:command, sendHTML(render(vm,"telegram")). node --check OK. Loader: loaded 4 plugins (skipped 0 errors 0). Nol patch baru, drop-in tak diedit.
✅ Fase 3 gerbang: harness 17/17 — hook wiring (/status+/positions handled=true; /wallet+/help handled=false), struktur view /status (header+Wallet+Performa+Sistem ada; Realized+Insight DEFERRED absen — cocok golden status.txt seksi yang dipertahankan), struktur /positions (header+count, pair, in-range/OOR state, PnL+Value, held per-posisi DEFERRED footer ◎0.000). Golden positions.txt "No open positions." TANPA ikon; fork-ref source ADA ICON.position prefix (💼) → port setia fork, golden kemungkinan build lama/REPL (catat, bukan STOP — golden = pembanding struktur, bukan source). tests: telegram-cmds 13/13 (asersi /status diupdate: TIDAK-handled→handled 3.6; +test /wallel TETAP jatuh vanilla), profile-tools 10/10 (loader assert 3→4). smoke PASS (hooks 8, patcher 14, loader, inventaris zenpack-plugins 4/4). Boot penuh: loaded 4 errors 0, tanpa throw. Siklus uninstall(porcelain 0)→reinstall→boot OK. manifest stage 3.6 (plugins 4, zenpack_plugins 4). npm test PASS.

# Stage 3.5 — wiring 2 tool LLM custom (get_time_profile + get_narrative_profile)

✅ Fase 0 verifikasi: HEAD e7ddd31; vanilla-test kondisi terpasang 3.4 (pola biasa). Recon cocok: fork executor get_time_profile/get_narrative_profile (:258-259), fork definitions 2 schema :995-1021, fork lessons getHourlyProfile :1046 + getNarrativeProfile :1153; vanilla toolMap `const toolMap = {` di executor :252 (geser dr :248 brief — patch 02 terpasang, anchor-based aman), executeTool resolve toolMap[name], kedua fungsi absen vanilla (grep 0).
   AUDIT 0.3 dependensi (vonis per item): isFiniteNum ✅ ADA vanilla (:449) · load() ✅ ADA (:51) · SESSIONS+MIN_SESSION_SAMPLES ❌ absen → port (const read-only) · NARRATIVE_CATEGORIES+MIN_NARRATIVE_SAMPLES ❌ absen → port (const read-only) · getModePerformance ❌ absen → port (read-only, filter atas load()) · keepActiveRacikan ❌ absen → port (read-only, baca config.activeSetup) · import isPaperMode (paper-trading.js = drop-in terpasang, read-only atas env+config) + import config (config.js export const config ✓, nol siklus: paper-trading→config saja) → 2 import ikut 04a (ESM hoisted, EOF legal). WIB_OFFSET_HOURS TIDAK diport (hanya dipakai currentWibSession, bukan dep). NOL dependensi sentuh tulis/money — semua agregasi baca.
   TEMUAN 0.4 konsumsi: definitions.js:1116 `export const tools = toolDefinitions.map(...)` = transform SEKALI saat module load, TAPI agent.js:71-84 filter array `tools` PER-PANGGILAN (getToolsForRole dipanggil per request :210) → mutasi runtime array `tools` TERLIHAT agent. STOP-condition (mutasi tak terlihat) TIDAK kena. Desain 04b: registrar definitions push ke toolDefinitions DAN tools (mirror transform :1116-1124). Registrar via appendPatch EOF (bukan inject anchor `};` — tak unik; function declaration EOF tetap jangkau module scope).
   CATATAN exposure role: fork expose 2 tool via SCREENER_TOOLS (fork agent.js:15 — baris core MODIFIED, di luar scope patch tipis, nasib sama smi → tunda). Vanilla: 2 tool terlihat jalur GENERAL fallback (agent.js:83, non-intent).
✅ Fase 1 patch 04a: core-patches/04a-lessons-profile-helpers.mjs — append VERBATIM fork lessons.js (import :14-15, konstanta :47-49+:51-60+:62-69 [WIB_OFFSET_HOURS :50 di-skip, bukan dep], keepActiveRacikan :885-895, getModePerformance :956-973, getHourlyProfile :1039-1093, getNarrativeProfile :1145-1192; segmen dicek byte-identik via builder). Marker zen-pack:04a-lessons-profile-helpers. node --check auto (patcher), boot: loaded 2 errors 0 + 401 baseline, apply 2x skipped-idempotent.
✅ Fase 2 patch 04b: registrar via appendPatch EOF (BUKAN inject anchor `};` — tak unik; function declaration EOF jangkau module scope). executor.js: zenpackRegisterTool. definitions.js: zenpackRegisterToolDef push ke toolDefinitions DAN tools (mirror transform :1116-1124, temuan 0.4). Additive terbukti byte-level (definitions: head -n-15 == .orig persis; executor appendPatch by construction). Boot loaded 2 errors 0 + 401 ×2. Revert 6 patch (17 file, index+lessons shared): semua restored+verify clean, porcelain M=0 → re-apply OK.
✅ Fase 3 plugin zenpack-plugins/20-profile-tools.js: import statis registrar+lessons (aman — plugin di-import dinamis loader saat runtime), registrasi DALAM register(). Schema VERBATIM fork definitions.js:995-1021, handler pola fork executor.js:258-259. node --check + loader test hijau.
✅ Fase 4 gerbang: tests/profile-tools.test.mjs 10/10 — loader 3/0/0; bukti registrasi runtime (pra-load 2 tool absen); executeTool get_time_profile/get_narrative_profile graceful data kosong (timezone WIB, 5 sesi, min_samples 8); tools runtime +2 schema (mirror transform additionalProperties:false); regresi vanilla list_strategies + get_recent_decisions (read-only, tanpa network) tetap resolve; paritas kunci statis 45 + 2 runtime = 47 cocok fork; guard Unknown tool utuh. Test telegram 12/12 tetap hijau (user-config di-backup/restore, artefak profiles/exports dibersihkan). Boot penuh: loaded 3 plugins (skipped 0, errors 0) + baseline 401 only (jenis identik). Siklus: uninstall 6 patch revert hash-verify clean + porcelain 0 → reinstall → boot OK. manifest stage 3.5 (+patches 04a/04b, plugins 3, catatan smi ditunda 5.8). npm test SMOKE PASS + unit fail 0.

# Stage 4

✅ 4.1 logger.js — vonis-only. paths-routing covered by patch 02; logSnapshot
   (fork logger.js:79-93) = dead code (0 call sites), DROPPED by owner
   decision. No patch, no plugin.

✅ 4.2 prompt.js → plugin (POLA A post-transform). prompt.js vanilla NOL sentuh.
   Patch 05-prompt-hook: 1 titik agent.js:173 (const→let systemPrompt + emitSync
   "prompt:build" via `await import("./zenpack-lib/hooks.js")` — bukan globalThis;
   __zenpackHooks module-local index.js, agent.js modul beda; hooks.js ESM
   singleton = registry sama; degrade-safe try/catch). Plugin 40-prompt-racikan:
   transform T1-T8 per agentType atas STRING RENDER vanilla, FAIL-LOUD mustReplace
   (anchor miss→warn+prompt utuh). racikanRules port VERBATIM fork prompt.js:21-38.
   GOLDEN PARITY tests/prompt-racikan.test.mjs 8/8 — SCREENER/MANAGER/GENERAL ×
   {notesFull+convOff, notesEmpty+convOn} byte-identik vs fork-ref pasca-normalisasi
   (Timestamp + blok `Config:{}` JSON = skema config.js beda fork↔vanilla, di luar
   scope 4.2) + anchor-miss degrade + non-string guard. Boot loaded 5 plugins
   errors 0, 0 anchor-miss on real screener build. Full cycle install→boot→tests→
   uninstall(porcelain 0)→reinstall→boot OK. manifest stage 4.2 (patch 05, plugin
   40, zenpack_plugins 5). DEFER timeProfile/narrativeProfile → 6.4/6.5 (tabel).
   TEMUAN: T7 anchor "instruction IS the confirmation." general-only (manager lean
   early-return tak punya); brief bilang manager/general → fork ground-truth
   general-only, cocok diff, bukan STOP. `else if MANAGER` block bawah = dead code.

✅ 4.3 state.js — verdict-only. A: STATE_FILE covered by patch 02.
   B/C/D deferred (see debt table). No patch, no plugin.

✅ 4.4 pool-memory.js — verdict-only. Routing covered patch 02;
   getDeployedPoolAddresses additive, consumer briefing.js only → DEFER 6.5/6.6.

✅ 4.5 smart-wallets.js — verdict-only. Routing-only, covered patch 02. No debt.

✅ 4.6 strategy-library.js — patch 06-strategy-no-autoseed. Vanilla-main
   auto-seed 5 strategi default + set active saat modul load (top-level
   `ensureDefaultStrategies();` @L115). Fork + yunus-experimental: blok DIHAPUS.
   Patch 06 = 1 replaceLine: call → comment `[zen-pack:06]`; definisi
   DEFAULT_STRATEGIES + function dibiarkan (dead code, setia byte). Bukti
   perilaku: modul load di data-dir isolasi TAK bikin strategy-library.json,
   active tetap null (nol auto-pick = fork). Routing STRATEGY_FILE sudah patch 02.

✅ 4.7 token-blacklist.js — patch 07-blacklist-failopen. Vanilla-main load()
   FAIL-CLOSED (JSON korup → log + throw "Safety blacklist is unreadable" → bot
   berhenti). Fork + yunus-experimental FAIL-OPEN (`catch { return {}; }`). Patch
   07 = 1 replaceLine blok catch multi-baris (replaceLine = exact-substring
   src.replace, multiline-safe → patcher TAK di-extend); marker `[zen-pack:07]`.
   Bukti: blacklist korup ("{bad json") → isBlacklisted() return false, NO throw
   (bot jalan = fork). Routing BLACKLIST_FILE sudah patch 02.

   GATE PENUH 4.6+4.7: install (06+07 replaced, runner ^\d\d[a-z]?- kena) →
   boot loaded 5 plugins errors 0 → tests hijau (hooks 8, loader 0-err, patcher
   14, paths 12/12, profile 10/10, telegram 19/19, prompt-racikan 8/0) →
   uninstall (semua patched file restore hash-verify clean, porcelain 0) →
   reinstall (06+07 replaced) → boot 5 plugins errors 0. manifest stage 4.7
   (+patches 06/07). CATATAN: patcher.js TIDAK diubah — replaceLine sudah cukup
   untuk ganti-blok multi-baris.

# FASE 5.1 — config.js bag 1 (key custom → plugin 50-config-ext)

✅ FASE A recon (read-only, bukti file:line):
   A.1 anchor vanilla-test/config.js (335 baris):
     - dryRun L41: `if (u.dryRun !== undefined) process.env.DRY_RUN ||= String(u.dryRun);`
       (brief ±47, aktual 41 — `||=` = ENV menang; fork mau USER menang → patch 09).
     - `export const config = {` L66, penutup `};` L265.
     - `export function reloadScreeningThresholds()` L295 → NOT async (body dibungkus
       satu try/catch L296-334, `}` L335). Titik hook = akhir badan try, sesudah blok
       `config.strategy.defaultBinsBelow = Math.max(...)` L330-333, sebelum `} catch` L334.
       KEPUTUSAN patch 08: bentuk SYNC (import statis emitSync + panggil langsung) —
       fungsi non-async, tak bisa `await import`. hooks.js dijamin ada pasca-install
       (install.sh copy lib→zenpack-lib); call di-wrap try/catch = fail-open runtime.
   A.2 urutan-import (KRITIS): grep fork-ref konsumen config.experiments/promptNotes/
     strategy.dualSide/management.sizingMode/strategyLock/profile/activeSetup — SEMUA
     dibaca DALAM fungsi (call-time), semua pakai `?.`+`??` default. NOL pembacaan
     top-level saat import. Desain mutasi-config-di-register() AMAN. TIDAK STOP.
   A.3 diff fork-ref vs vanilla-test config.js — delta key custom (fork punya, vanilla
     tak punya) yg PUNYA konsumen = persis daftar brief FASE C item 1,3,4,5,6,7,8,9,10,
     11,12. Key fork DI LUAR daftar brief: `screening.source` (screeningSource) + gmgn
     SUPERSET ~40 key (minSmartDegenCount/requireKol/indicatorRules/maxRugRatio/dst).
     VONIS: keduanya ORPHAN/no-op di vanilla — grep vanilla NOL konsumen
     (tools/gmgn.js cuma baca 5 key gmgn yg vanilla sudah punya: apiKey/baseUrl/
     requestDelayMs/maxRetries/feeSource; `config.screening.source` tak dibaca). Sama
     perlakuan brief item-2 orphan maxBundlePct/athFilterPct (cuma di-`delete` setup.js
     :730-731, tak ada read-path). → TIDAK ditambah, dicatat vonis no-op. BUKAN STOP
     (aturan orphan brief item-2 diterapkan konsisten). Brief FASE C lengkap+akurat
     utk key ber-konsumen. reload fork L638-647 custom delta = persis brief item-13.
   Commit: recon-only (no code). HEAD 5717946.

✅ FASE B patch 08 + 09 (via lib/patcher.js existing, patcher TAK di-extend):
   - 08-config-reload-hook.mjs: 2 item applyPatch (config.js). itemA marker
     `zen-pack:08-config-reload-import` anchor=import screening-scales, inject
     `import { emitSync } from "./zenpack-lib/hooks.js"`. itemB marker
     `zen-pack:08-config-reload-hook` anchor=blok multiline `config.strategy.
     defaultBinsBelow = Math.max(...)` (unik, count 1), inject
     `try { emitSync("config:reload", { config, fresh }); } catch {}` di akhir
     badan try (sebelum `} catch`). BENTUK SYNC (reload non-async). Fail-open.
   - 09-dryrun-userconfig-wins.mjs: replaceLine `||=`→`=` (OLD unik count 1).
   node --check via patcher auto (apply sukses). Commit 3417ef3 (08) + 3be072c (09).

✅ FASE C plugin zenpack-plugins/50-config-ext.js (register() mutasi config live):
   - injectCustomKeys(readUserConfig()) — baca user-config via paths.userConfigPath
     (fail-loud: unreadable → warn + u={} degrade default, tak crash).
   - normalizePromptNotes port VERBATIM fork:77-86. Semua default port VERBATIM
     fork config.js (top-level 115-118, screening.categories 145, management
     240-253, strategy 269+277-280, schedule 292-293, llm 300, learning 312-314,
     jupiter 365, indicators 375+388+394-396, experiments 404-479 [16 flag],
     reports 485-487).
   - handler config:reload (onConfigReload) port fork reload delta 638-647
     (screeningCategories/promptNotes/activeSetup/evolveEnabled/sizingMode/
     rentPerPositionSol) dari ctx.fresh. manifest priority 50.
   - orphan source + gmgn-superset TIDAK diport (vonis FASE A.3).

✅ FASE D test + gate penuh (target vanilla-test, HEAD 5ab14b4 pristine):
   - tests/config-ext.test.mjs 15/15: tabel key→default fork per blok; DEVIASI
     opportunity.enabled===true; reload sizingMode/categories/promptNotes/
     evolveEnabled/rentPerPositionSol via hook; patch 09 subprocess (env
     DRY_RUN=true + user-config dryRun:false → process.env.DRY_RUN==="false").
   - profile-tools bumped 5→6 plugin.
   - Harness: hooks 8/0, loader OK, patcher 14/0, paths 12/12, profile 10/0,
     telegram 19/19 (fresh; CATATAN pre-existing: telegram test tinggalkan
     presets/_backup.json → non-idempotent antar-run, BUKAN regresi 5.1),
     prompt-racikan 8/0 (butuh arg fork-ref), config-ext 15/0.
   - Boot DRY_RUN: `loaded 6 plugins (skipped 0, errors 0)` + baseline 401 only,
     nol stacktrace/TypeError.
   - Siklus: install (08×2 patched + 09 replaced) → boot 6 → tests → uninstall
     (config.js restore hash-verify CLEAN, porcelain KOSONG pasca git clean -fd +
     checkout; residu cuma exports/+profiles/ = artefak boot, bukan pack) →
     reinstall → boot 6 errors 0 → config-ext 15/15. Sandbox pulih pristine 5ab14b4.

✅ FASE E manifest + progress: stage 5.1, patches +08/09, plugins +50,
   zenpack_plugins 6, blok stage_5_1 (deviasi opportunity 8.4, orphan source/gmgn,
   defer 5.2 sizing fn, reload sync-form). manifest valid JSON.

# FASE 5.2 (vonis-only, tutup config.js) + 5.3 (agent.js bag 1)

✅ FASE 0 — 5.2 vonis-only:
   0.1 VONIS: 4 fungsi sizing export fork config.js (minDeployAmount,
       computeDeployAmount mode maximize, applyConvictionSizing,
       persistConfigChange) = DEFER. Konsumen: executor.js → 5.5, index.js → 7.x.
       Nol kode fase ini.
   0.2 drop-in config-schema.js + config-origin.js (pack sejak Stage 2, root):
       KEDUA self-contained — NOL import (grep `^import`/`from` = kosong),
       node --check OK, tak ada dependensi absen dari config.js vanilla.
       Konsumen sudah wired (plugin 30-render-views, views/config.js,
       views/settings.js). Isolate-import LOLOS, TIDAK perlu build/DEFER.
   Commit vonis b402484. ⬜ FASE A/B/C/D 5.3 berikut.

✅ FASE A recon 5.3 (vanilla-test/agent.js 416 baris; fork-ref 535 baris):
   A.1 SCREENER_TOOLS vanilla L8 (unik count 1) = 11 tool [deploy_position,
       get_active_bin, get_top_candidates, check_smart_wallets_on_pool,
       get_token_holders, get_token_narrative, get_token_info, search_pools,
       get_pool_memory, get_wallet_balance, get_my_positions]. Fork L15 = 7 tool
       (slim) + komentar 6-baris efficiency (fork agent.js:9-14).
   A.2 INTENT_PATTERNS vanilla blok L50-68 (17 entri + `];`), unik. Fork L64-82
       = 17 entri BILINGUAL (EN+ID).
   A.3 4 regex: MUTATING_TOOL_INTENTS vanilla L104 (fork L129 +ID+enable/disable/
       toggle), LIVE_DATA_TOOL_INTENTS L105 (fork L130 +ID), CONFIG_READ_ONLY_INTENTS
       L106 (fork L131 +ID), DECISION_EXPLANATION_INTENTS L107 (fork L132 +ID). Semua
       unik count 1.
   A.4 CHAT_CONFIRM_TOOLS titik sisip fork = setelah SCREENER_TOOLS (L15), sebelum
       GENERAL_INTENT_ONLY_TOOLS (fork L21).
   A.5 PRASYARAT UTANG: install pack → loadPlugins → tools/definitions.js `tools`:
       pre-load get_time_profile=false, POST-load get_time_profile=true +
       get_narrative_profile=true. Tool TERDAFTAR runtime (plugin 20 / patch 04b).
       SCREENER exposure sah, BUKAN tool hantu. TIDAK STOP.
   A.6 CHAT_CONFIRM_TOOLS konsumen fork: grep = 2 ref saja (def L21 + runToolCall
       L470 interactive/onConfirmRequired). Konsumen TUNGGAL = runToolCall (belum
       diport, 5.4). VONIS: CHAT_CONFIRM_TOOLS DEFER → 5.4, patch 10 TIDAK
       menyisipkannya (konstanta tanpa konsumen = kode tidur).
   Commit recon-only. ⬜ FASE B/C/D.
