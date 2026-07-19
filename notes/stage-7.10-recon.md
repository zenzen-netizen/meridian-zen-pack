# Stage 7.10-A — sapu-jagat residu Stage 7

Status checkpoint: **DISETUJUI owner 2026-07-19; dilanjutkan ke 7.10-B/C.** Bagian
audit di bawah adalah rekaman read-only sebelum port. Hasil eksekusi dan inventaris
akhir ada di `notes/zen-pack-progress-7.10.md`.

## 1. Sumber, metode, dan hasil total

- Fork terkunci: `643e954` dari `/home/ubuntu/meridianzen`.
- Vanilla terkunci: `5ab14b476e4e8d25c58f989c77b161721e1a505f`.
- Target: `/home/ubuntu/meridian-lab/vanilla-test`, HEAD detached pada `5ab14b4`,
  dengan pack Stage 7.9 terpasang.
- Pack sebelum audit bersih: `main...origin/main`, HEAD `24282d1`.
- Audit memakai union penuh perubahan `5ab14b4..643e954`: **137 file**, bukan
  hanya file runtime atau file yang masih ada di tree fork.
- Triple-compare isi file menghasilkan:
  - **38** file installed byte-identik fork;
  - **79** file installed byte-identik vanilla (fork delta sengaja tidak mengganti
    baseline, termasuk file yang fork hapus);
  - **20** file mempunyai gabungan patch/plugin/adaptasi; seluruh hunk ditelusuri
    terhadap ledger Stage 3–7 dan raw diff langsung.

Hasil: enam residu yang sudah disebut owner terkonfirmasi. Ada **satu temuan baru**:
`dev-blocklist.js` fail-open fork belum mempunyai vonis owner eksplisit. Tidak ada
residu belum berstatus lain.

## 2. Ledger seluruh file delta

Tabel ini mengklasifikasikan seluruh 137 path. Daftar dalam satu sel adalah satu
kelas keputusan yang sama; tidak ada path perubahan fork yang dibiarkan di luar
ledger.

| Kelas | Jumlah | Path / cakupan | Status |
|---|---:|---|---|
| Drop-in byte-identik fork | 38 | `SETTINGS-GUIDE.md`, `addprofil.js`, `briefing.js`, `candidate-memory.js`, `config-origin.js`, `config-schema.js`, `gas-tracker.js`, `guide.js`, `llm-cost-tracker.js`, `openrouter-usage.js`, `paper-trading.js`, `paths.js`, `pnl-tracker.js`, `preset-manager.js`, `preset.js`, `profil-export.js`, `racikan-export.js`, `reports.js`, tiga `scripts/*`, `sol-tracker.js`, `test-screening.js`, `tools/{chart-indicators,gmgn,smi}.js`, dan 12 `views/*` | ✅ sudah diport |
| Fork deletion tidak diterapkan | 18 | 11 `.claude/*`, `deployer-blacklist.json`, empat `discord-listener/*`, `tools/agent-meridian.js`, `utils/number.js` | 📋 baseline vanilla dipertahankan; pack tidak menghapus fasilitas upstream. `agent-meridian.js` juga owner transport vanilla untuk DLMM/study |
| Dokumen/dev artifact fork tidak didistribusikan | 45 | `MAINZEN-V2-JOURNAL.md`, `MAINZEN-V3-WORKFLOW.md`, `NEXT-SESSION.md`, `backup.sh`, dua `docs/hivemind-*`, dan 39 `notes/*`/`scratchpad/*` | 🅳 DROP packaging; bukan runtime atau bahan instalasi pack |
| Surface repo/setup tetap vanilla | 11 | `.gitignore`, `CLAUDE.md`, `README.md`, `cli.js`, `ecosystem.config.cjs`, `gmgn-config.example.json`, `package.json`, `package-lock.json`, `setup.js`, `test/test-screening.js`, `user-config.example.json` | 📋 deviasi sadar: pack memakai installer/plugin sendiri, mempertahankan CLI/upstream dependency superset, dan tidak menimpa docs/example yang modified |
| Prompt fork via transform | 1 | `prompt.js` | ✅ sudah diport oleh Patch 05 + Plugin 40; file core sengaja tetap vanilla |
| Path/profile fork via patch | 1 | `envcrypt.js` | 📋 baseline-delta tercatat sejak Patch 02: runtime `.env` tetap root; data/config lain sadar `MERIDIAN_DATA_DIR` |
| Comment-only | 1 | `signal-tracker.js` | 🅳 tidak ada delta executable; staged-signal producer/consumer sudah hidup di jalur lain |
| Keputusan Stage 8 | 1 | `tools/study.js` | 📋 utang keputusan-basis Stage 8: pertahankan transport `agent-meridian.js`, jangan ganti direct fetch fork |
| Guard safety baru ditemukan | 1 | `dev-blocklist.js` | ❗ fork mengubah parse-error dari fail-closed menjadi fail-open; belum ada vonis owner |
| Core gabungan patch/plugin/adaptasi | 20 | `agent.js`, `config.js`, `decision-log.js`, `hivemind.js`, `index.js`, `lessons.js`, `logger.js`, `pool-memory.js`, `signal-weights.js`, `smart-wallets.js`, `state.js`, `strategy-library.js`, `telegram.js`, `token-blacklist.js`, `tools/{definitions,dlmm,executor,pnl,screening,wallet}.js` | Dirinci per hunk-family di bawah |

Jumlah kelas: `38 + 18 + 45 + 11 + 1 + 1 + 1 + 1 + 1 + 20 = 137`.

## 3. Accounting 20 file gabungan

| File / hunk-family | Klasifikasi akhir |
|---|---|
| `agent.js` | ✅ Patch 10/11/29 + Plugin 70 menutup tool sets, fallback/salvage, confirmation, cost, max tokens, arg repair, dan dedup. Dua baseline transport delta (`recordLlmCost` always-on, GENERAL 8192) sudah tercatat |
| `config.js` | ✅ custom config hidup lewat Plugin 50, sizing lewat `zenpack-lib/sizing.js`, `persistConfigChange` lewat Patch 30; 📋 core factory/upstream scaling tetap vanilla dan modified docs tidak ditimpa |
| `decision-log.js` | ✅ paths routing; 📋 warning JSON korup milik vanilla dipertahankan (fork diam), observability lebih kuat |
| `hivemind.js` | ✅ paths routing; 🅳 fork hanya mengekspor `shouldCountInAdjustedWinRate`, tetapi seluruh repo tidak punya external consumer |
| `index.js` | ✅ hunks Stage 3–7 dimiliki Patch 01/02/03b/28/30/32 + Plugin 10/30/60/70/80/90; 🅳 management UI lama, paper snapshot guard, mesin 15s, emergency helper, `_pollTriggeredAt`, queue/report refactor, dan dead helper sudah tercatat DROP; 📋 opportunity poller vanilla tetap; ❗ empat keluarga residu owner: indicator exit, idle cooldown, `/set`+`/setcfg` display, serta executor-linked behavior |
| `lessons.js` | ✅ read/write layer Patch 03a/04a/21/25; selisih raw hanya marker/relokasi, tanpa semantic residue |
| `logger.js` | ✅ paths routing; 🅳 `logSnapshot` fork nol call-site, owner sudah DROP |
| `pool-memory.js` | ✅ paths routing + `getDeployedPoolAddresses` Patch 26a |
| `signal-weights.js` | ✅ paths routing; 🅳 fork hanya menambah export `loadWeights`/`saveWeights`, nol external consumer |
| `smart-wallets.js` | ✅ paths routing saja; tidak ada hunk perilaku lain |
| `state.js` | ✅ Patch 30/33 menutup briefing + lifecycle fields/backfill/excursion; 🅳 `recordRebalance` nol consumer dan mesin queue/resolve 15s diganti vanilla 2-tick atas keputusan owner |
| `strategy-library.js` | ✅ paths routing + Patch 06 menghapus auto-seed sesuai fork |
| `telegram.js` | ✅ Patch 18/23 menutup chunking, render, notify, reports, dan routing; selisih raw hanya marker/adaptasi install |
| `token-blacklist.js` | ✅ paths routing + Patch 07 fail-open sesuai fork |
| `tools/definitions.js` | ✅ schema profile/deploy lewat registrar/Patch 13; ❗ dokumentasi + flat `key/value` untuk `update_config` ikut utang executor blok 1 |
| `tools/dlmm.js` | ✅ paper, dual-side, gas, relay, learning, cleanup, close-notif, dan backfill sudah diport; 📋 empat baseline transport/safety delta terkunci: `agent-meridian.js`, instruction-key fallback, relay-disabled comment, dynamic `node-fetch` fallback |
| `tools/executor.js` | ✅ blok money 2–5/7, CONFIG_MAP non-GMGN, registrars; ❗ blok 1 `update_config` split persistence; 📋/❗ blok 6 diperiksa khusus di §4 |
| `tools/pnl.js` | ✅ enam helper display Patch 20f; ❗ empat hunk Jupiter symbol/display tersisa |
| `tools/screening.js` | ✅ multi-category, GMGN dispatch/funnel, yield proxy; 📋 `degenScore` dan opportunity dependencies vanilla sengaja dipertahankan |
| `tools/wallet.js` | ✅ full-parity fork; beda fisik hanya marker Patch 14 |

## 4. Bukti dan rekomendasi residu

| Item | Bukti installed vs fork | Rekomendasi |
|---|---|---|
| **indicator-exit** 🔴 | Fork `index.js:564–570` memanggil helper setelah lima hard deterministic rules dan sebelum CLAIM. `getDeterministicCloseRule` fork `1466–1509` setara vanilla; delta sebenarnya adalah import, call-site, dan helper `1511–1528`. Installed tidak mempunyai `getIndicatorExitSignal` atau consumer `confirmIndicatorPreset({side:"exit"})`, sementara config/schema/UI `indicatorExitEnabled` sudah hidup. | **PORT sekarang.** Ini config yang tampak aktif tetapi saat ini no-op. Pertahankan urutan hard-rule → indicator → claim, default OFF, fail-safe null. Wajib paper harness + golden default-OFF + mocked confirmed/unconfirmed/error + ZERO-TX. Jangan ubah poller 2-tick tanpa otorisasi tambahan; scope exact fork hanya management cycle. |
| **idle-screening-cooldown** 🟠 | Fork `index.js:488–510`, hanya cabang zero-position, default OFF, shared `_screeningLastTriggered`, try/catch fail-open. Installed `258–262` selalu memicu screening; config/UI default `false`/20 menit sudah ada. Patch 32 sudah menjadikan `_screeningLastTriggered` core owner yang benar. | **PORT sekarang.** Patch kecil, menutup toggle no-op dan mengurangi LLM screening spam. Gate OFF byte/behavior-equivalent, ON before/after boundary, error fail-open, paper/ZERO-TX. |
| **`/set` note + `/setcfg`** | Aksi dasarnya **sudah ada** di installed `index.js:1626–1658`: `/set` memanggil `setPositionInstruction`; `/setcfg` memanggil `executeTool("update_config")`. Fork `3353–3387` hanya mengganti error/success rendering dan menambah snapshot `oldVal` agar ack `old → new`; tidak menambah write path. | **Jangan port runtime; resmikan deviasi display.** Ponytail: fungsi sudah bekerja, sedangkan port hanya kosmetik dan menambah anchor core. Jika owner menginginkan parity visual, port hanya render/`oldVal` verbatim; tidak boleh menduplikasi handler atau write. |
| **`tools/pnl.js` empat hunk Jupiter display** | Enam helper `resolveDisplayPair` dkk sudah ada. Yang belum: `getJupiterPrices` return `{prices,symbols}`, pass `symbols` ke `buildPosition`, heal `pair`, dan destructure/pass pada `computePositions`. Tidak menyentuh persisted record, PnL formula, exit, atau transaksi. | **PORT sekarang.** Menutup helper setengah-terpasang dan memperbaiki label `?-SOL`; golden prices/PnL harus identik, hanya `pair` berubah untuk unresolved name. Network mocked, ZERO-TX. |
| **executor blok 1 `update_config`** | Fork handler `tools/executor.js:300–660` adalah rewrite besar: flat `key/value`, `validateConfigValue`, redaction, seluruh GMGN map, `paths.gmgnConfigPath`, dan split persistence ke `gmgn-config.json`. Installed hanya memperluas vanilla CONFIG_MAP non-GMGN (Patch 27); Plugin 60 sengaja memblok edit GMGN dengan recovery note. Definitions flat schema juga belum dipasang. | **Resmikan utang PRA-8.** Bukan sapu kecil/verbatim independen. Kerjakan sebagai satu workstream executor paths Batch-2 + schema + GMGN persistence/redaction/migration; jangan mencungkil sebagian di 7.10. |
| **executor blok 6 auto-swap** 🔴 | Installed `index.js:194–200` menyalurkan CLOSE management ke `executeTool("close_position")`; poller `848–859` menyalurkan confirmed close ke helper management yang sama. Executor `651–675` punya retry lokal, dan close `733–742` memanggilnya fail-open; claim `743–745` juga memakai helper. Jadi D1 hidup pada management dan poller. Fork hanya mengganti owner lokal dengan export wallet/signature lain. | **DROP tercatat, bukan utang.** Port akan menjadi refactor tanpa fungsi baru dan berisiko adapter/owner ganda. Export wallet boleh tetap dead sampai ada consumer riil. |
| **NEW: `dev-blocklist.js` parse error** | Vanilla/installed `load()` log lalu throw `Safety blocklist is unreadable`; fork menggantinya dengan `catch { return {}; }`. Berbeda dari `token-blacklist.js`, delta ini belum pernah mendapat patch/vonis eksplisit. Dampaknya langsung ke hard filter deployer saat file korup. | **KEEP vanilla fail-closed sebagai baseline safety deviation.** Jangan port fail-open: korupsi guard seharusnya menghentikan screening/deploy, bukan menganggap daftar kosong. Owner perlu mengesahkan status ini agar ❗ menjadi 📋. |

## 5. Checkpoint owner

Rekomendasi paket 7.10-B minimum:

1. PORT indicator-exit dengan disiplin money penuh.
2. PORT idle-screening-cooldown dengan default-OFF parity + ZERO-TX.
3. DROP `/set`/`/setcfg` display delta (aksi sudah ada).
4. PORT empat hunk display `tools/pnl.js`.
5. PRA-8 executor blok 1 `update_config`.
6. DROP executor blok 6 auto-swap fork; D1 sudah tertutup choke point vanilla.
7. NEW: sahkan `dev-blocklist.js` vanilla fail-closed sebagai baseline deviation.

Checkpoint ini kemudian dibuka owner dengan tujuh vonis terkunci. Fase 7.10-B/C
selesai dan dicatat di `notes/zen-pack-progress-7.10.md`; rekomendasi historis di
atas tidak lagi berstatus menunggu.
