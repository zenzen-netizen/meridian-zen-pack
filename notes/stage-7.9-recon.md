# Stage 7.9-A Recon — cron management + exit fields

Status: **CHECKPOINT / STOP — menunggu keputusan owner.** Recon only; tidak ada
patch runtime, install, transaksi, atau restart.

## 1. Sumber dan kondisi target

- Vanilla terkunci: `5ab14b476e4e8d25c58f989c77b161721e1a505f`.
- Fork terkunci: `643e954`.
- `meridian-lab/LAB-INFO.txt` menyatakan dua SHA tersebut dan lock time
  `2026-07-11T07:29:40Z`.
- Object `643e954` tersedia di repo `/home/ubuntu/meridianzen`. Hasil
  `git show 643e954:{index.js,state.js}` byte-identik dengan
  `/home/ubuntu/meridian-lab/fork-ref/{index.js,state.js}`:
  - `index.js`: SHA-256
    `0907df5c6285c9ba4b23fac274e1fbe5694210ad22ab322052600a9b10fcd765`
  - `state.js`: SHA-256
    `a9234963758388f4149b4da9e68c5af8e0324f001e2d7379a63f6e77ce4c8e60`
- Pack sebelum recon bersih (`main...origin/main`, HEAD `43c1762`).
- Sandbox sengaja dirty karena hasil install/migration fase-fase lama; recon tidak
  mengubahnya.
- Bukti upstream penentu: commit `e559081` (`fix(pnl): unfreeze exits + 2-tick
  confirm + deterministic mgmt + opportunity poller`) secara eksplisit membuang
  timer 15 detik, `_pollTriggeredAt`, dan management-cooldown path; menggantinya
  dengan `confirmPeak`, `registerExitSignal`, `executeManagementActions`, dan
  direct confirmed close. Jadi Match-OLD untuk 7.9 adalah struktur vanilla baru,
  bukan struktur fork lama.

## 2. Vonis ringkas

1. **Mesin exit vanilla dipertahankan byte-for-byte.** Tidak ada port
   `shouldUsePnlRecheck`, `schedulePeakConfirmation`,
   `scheduleTrailingDropConfirmation`, timer map/konstanta, queue/resolve 15s,
   confirmed 30s window, atau `_pollTriggeredAt`.
2. **`emergencyCloseDirect` DROP TOTAL.** Vanilla sudah mempunyai jalur direct,
   LLM-free di `executeManagementActions`; poller mengunci `_managementBusy` di
   sekitar helper itu. Helper fork adalah owner lama yang digantikan oleh
   `e559081`.
3. Port runtime minimum yang benar adalah producer/shape state + backfill call
   yang hilang. Close notification, recorded recompute, dan auto-swap sudah hidup
   pada choke point vanilla `executeTool("close_position")` untuk management dan
   poller.
4. Ada dua hidden dependency yang perlu keputusan owner sebelum build:
   - Plugin 70 `/closeall` masih memanggil `closePosition` langsung sehingga
     melewati notif/F9/auto-swap milik `executeTool`.
   - Return `closePaperPosition` tidak membawa `peak_pnl_pct`, sehingga notif
     close paper menerima `peakPnlPct: null` meskipun state sudah terisi.

## 3. Tabel hunk `runManagementCycle` fork 471–664

Posisi target mengacu vanilla `5ab14b4`: `executeManagementActions` 161–219 dan
`runManagementCycle` 221–359. `installed` mengacu sandbox pasca-7.8.

| Delta fork | Posisi baru / owner vanilla | Status 7.9 | Mekanisme bila diteruskan | Dependency / alasan |
|---|---|---|---|---|
| `CYCLE_TITLE.mgmt` dan string report bergaya fork | `runManagementCycle` 232–242, report/finalize 292–355 | DROP 7.9 | Tidak ada | UI fork bukan daftar fitur terkunci; views sudah shipped tetapi management tetap vanilla |
| idle zero-position cooldown 488–510 | cabang vanilla 238–243 | LAPOR, DROP 7.9 | Patch cabang kecil jika kelak diotorisasi | Config/settings `idleScreeningCooldown*` sudah ada, mekanisme justru belum terpasang; residu setengah-port di luar daftar terkunci |
| paper guard pada `recordPositionSnapshot` 513–519 | map vanilla 245–249 | LAPOR, DROP 7.9 | Patch satu guard; tidak perlu override | `isPaperMode` tersedia. Tanpa guard, cycle paper menulis pool-memory live; tetapi fitur ini tidak ada di daftar “HANYA” 7.9 |
| queue peak + schedule 15s 521–530 | loop vanilla 251–262 | **DROP TERKUNCI** | Tidak ada | Pertahankan `confirmPeak(..., 1)` management backstop persis vanilla |
| trailing-drop queue/schedule 531–538 | loop vanilla 257–261 | **DROP TERKUNCI** | Tidak ada | Pertahankan exit detection vanilla; tidak boleh ada 15s/30s replay state |
| `exitMap` / hard-exit priority | vanilla 254–271 | SUDAH ADA | Tidak ada | Struktur vanilla setara dan lebih baru |
| instruction action | vanilla 273–277 | SUDAH ADA | Tidak ada | Dipertahankan |
| deterministic close rules | vanilla 279–283 | SUDAH ADA | Tidak ada | Dipertahankan |
| indicator exit 564–570 | setelah deterministic rule, sebelum claim | LAPOR, DROP 7.9 | Patch async loop jika kelak diotorisasi | Config/settings indicator exit dan chart helper sudah ada, tetapi `getIndicatorExitSignal`/management consumer tidak ada; setengah-port lain di luar daftar terkunci |
| claim/stay | vanilla 284–290 | SUDAH ADA | Tidak ada | Dipertahankan |
| fork `buildMgmtReport` | vanilla report builder 292–317 | DROP 7.9 | Tidak ada | Bukan fitur exit unik terkunci |
| fork memanggil LLM untuk semua action 590–623 | **choke point vanilla** `executeManagementActions` 161–219, call 325–327 | GANTI-OLD / jangan port | Reuse helper vanilla | Vanilla menjalankan CLOSE/CLAIM direct tanpa LLM dan hanya INSTRUCTION ke LLM; inilah fix `e559081` |
| post-management screening | vanilla 333–339 | SUDAH ADA | Tidak ada | Cache 7.8 diisi oleh Plugin 90 saat `runScreeningCycle` mengambil alih |
| fork `cycleFail`, live-message leak guard, `drainTelegramQueue` | vanilla catch/finally 340–356 | DROP 7.9 | Tidak ada | Di luar daftar fitur terkunci; queue tetap didrain oleh screening/health dan jalur lain |
| `maybeFireLearningReport` 659–661 | setelah finally / return | **SUDAH ADA** sebagai hook installed 377–382 | Jangan dobel | Plugin 80 owner `management:afterCycle` dan fail-open |

### Keputusan mekanisme management

- **Tidak memakai override choke-point pola 7.8.** Override satu cycle penuh akan
  menyalin struktur fork lama dan berisiko menghidupkan kembali mesin 15 detik.
- **Tidak perlu patch management/poller untuk D1/D2/F9.** Choke point vanilla
  `executeManagementActions -> executeTool("close_position")` sudah menjalankan
  semua post-effect tersebut.
- Bila owner memilih memperbaiki Plugin 70, perubahan terkecil adalah mengganti
  call `/closeall` dari `runtime.closePosition(...)` menjadi
  `runtime.executeTool("close_position", ...)`; bukan membuat helper close ketiga.

## 4. Pilah poller fork 1305–1401 per blok/baris

| Fork line | Isi | Vonis terhadap poller 2-tick |
|---|---|---|
| 1305–1308 | komentar + interval, tanpa `confirmTicks` | DROP komentar lama; interval SUDAH ADA; pertahankan deklarasi `confirmTicks` vanilla 725 |
| 1309–1316 | interval, busy guards, tracked guard, fetch, loop | SUDAH ADA pada vanilla 727–734 |
| 1317–1323 | queue peak + timer 15s | **DROP TERKUNCI**; pertahankan `confirmPeak(p.position, p.pnl_pct, confirmTicks)` vanilla 735 |
| 1324 | `updatePnlAndCheckExits` | SUDAH ADA vanilla 738 |
| 1325–1331 | special trailing 15s confirmation | **DROP TERKUNCI** |
| 1332–1345 | STOP_LOSS via `emergencyCloseDirect`, fallback management | DROP; sinyal masuk `registerExitSignal` seperti semua exit |
| 1346–1358 | non-emergency direct helper/fallback | DROP; setelah 2 tick, vanilla direct lewat `executeManagementActions` |
| 1359–1368 | `_pollTriggeredAt` management cooldown untuk pending confirm | **DROP TERKUNCI**; ini tepat jalur yang `e559081` hapus karena menelan exit |
| 1370 | deterministic close evaluation | SUDAH ADA vanilla 739 |
| 1371–1395 | rule 1/rule 2–5 via emergency helper/fallback | DROP; vanilla mengubahnya menjadi signal `RULE_n`, lalu 2-tick confirm |
| vanilla 740–746 | aggregate signal + `registerExitSignal` | **PERTAHANKAN VERBATIM**, tidak punya padanan fork |
| vanilla 748–759 | confirmed direct close, `_managementBusy`, `executeManagementActions` | **PERTAHANKAN VERBATIM**; ini tempat D1/D2/F9 sudah terpasang melalui `executeTool` |
| 1397–1401 | one-action-per-tick/finally/interval | SUDAH ADA secara struktur; pertahankan teks vanilla |

Tidak ada baris fork poller yang perlu “dipasang ke 2-tick”. Fitur unik fork yang
diminta sudah berada di post-hook `executeTool` di bawah jalur 2-tick. Satu-satunya
port baru di jalur tick adalah side-effect state trough/price di fungsi
`updatePnlAndCheckExits`, tanpa mengubah hasil exit atau confirmation count.

## 5. Vonis `emergencyCloseDirect` fork 1207–1248

**DROP TOTAL. Bukti:**

- Comment commit upstream `e559081` menyatakan deterministic CLOSE/CLAIM sekarang
  direct via `executeTool`, poller menutup langsung setelah confirmed exit, dan
  cooldown management lama dihapus.
- Vanilla `executeManagementActions` 174–180 memanggil
  `executeTool("close_position")`, bukan LLM.
- Poller vanilla 748–759 mengangkat `_managementBusy` sinkron sebelum helper dan
  melepasnya di `finally`; anti-double-close yang dijanjikan helper fork sudah ada.
- `executeTool` installed 726–742 sudah melakukan:
  - `notifyClose` dengan `recorded_pnl_*` dan `peak_pnl_pct`;
  - auto-swap base ke SOL dengan retry, fail-open;
  - pool-memory note dan seluruh logging/safety wrapper.
- Helper fork memanggil `closePosition` langsung lalu menduplikasi subset post-hook.
  Port helper akan menciptakan owner close kedua, atau double-notify/double-swap bila
  dicampur dengan `executeTool`.
- `_pollTriggeredAt` dan fallback management dari helper adalah bagian mesin lama,
  bukan fitur D1/D2; keduanya harus ikut DROP.

### Status D1/D2/F9 sekarang

| Fitur | Jalur management + poller vanilla | Status installed |
|---|---|---|
| D1 auto-swap fail-open | `executeTool` close post-hook, local retry helper | SUDAH HIDUP; exported wallet helper fork sudah shipped tetapi dead-export |
| D2 notif close | `executeTool` close post-hook | SUDAH HIDUP |
| peakPnl notif | dlmm return `peak_pnl_pct` -> executor `peakPnlPct` | SUDAH untuk relay/live; **GAP paper return** |
| F9-light recorded recompute | dlmm relay/local `recorded_pnl_usd/pct` -> executor fallback | SUDAH untuk relay/live; paper fallback sudah memakai net simulated PnL yang sama dengan record |

Ponytail/full verdict: jangan mengganti local retry helper executor dengan exported
wallet helper hanya untuk “menghidupkan export”; perilakunya sudah ada dan perubahan
signature/return menambah adapter tanpa nilai. Export wallet dipakai hanya bila owner
memilih mempertahankan suatu direct-`closePosition` route (tidak direkomendasikan).

## 6. `state.js` full diff dan klasifikasi

| Hunk fork vs vanilla | Status / keputusan |
|---|---|
| import `paths`, `STATE_FILE = paths.statePath` | SUDAH installed oleh patch 02 |
| import `config` | PORT; dibutuhkan stamp `active_setup/profile` |
| `makePositionRecord` shared factory | PORT dengan merge sadar: shape fork + field confirmation vanilla |
| `narrative_category`, `shadow_signals`, `active_setup`, `profile` | PORT verbatim value/default semantics |
| protect `deployed_at` saat re-track | PORT |
| `ensureDeployedAt` | PORT |
| `trough_pnl_pct`, `price_peak_pct`, `price_trough_pct` defaults | PORT |
| pending fields fork (`pending_trailing_*`, `confirmed_trailing_*`) | **DROP TERKUNCI** |
| pending fields vanilla (`pending_peak_confirm_count`, `pending_exit_*`) | **WAJIB dipertahankan** |
| `recordRebalance` fork 283–301 | RESIDU di luar paket, unused di seluruh fork; LAPOR dan DROP/YAGNI |
| queue/resolve peak + trailing 315–429 | **DROP TOTAL**; pertahankan `confirmPeak` dan `registerExitSignal` vanilla byte-for-byte |
| trough tracking 493–511 | PORT side-effect saja, termasuk suspicious guard |
| raw price excursion 513–528 | PORT verbatim formula/rounding |
| confirmed trailing replay 487–500 | **DROP TERKUNCI** |
| briefing pin/milestone/periodic fields 618–668 | SUDAH installed patch 30; jangan dobel |

### Record shape target (gabungan yang aman)

Target memakai factory fork untuk metadata dan empat excursion fields, tetapi tetap
memiliki record confirmation vanilla berikut tanpa perubahan:

- `pending_peak_pnl_pct`
- `pending_peak_confirm_count`
- `pending_peak_started_at`
- `pending_exit_action`
- `pending_exit_count`
- `pending_exit_started_at`
- `trailing_active`

Tidak ada `pending_trailing_*` atau `confirmed_trailing_*`.

### Hidden dependency `ensureDeployedAt`

Export state saja tidak cukup. Fork `tools/dlmm.js` mengimpor `ensureDeployedAt`
dan memanggilnya sebelum `getTrackedPosition` pada fallback portfolio loop. Installed
target belum mempunyai import/call tersebut meskipun komentar orphan-cleanup sudah
mengklaim helper ada. Build harus memasang dua anchor itu lewat patcher; jika tidak,
fitur backfill tidak pernah berjalan.

## 7. Interplay plugin/hook/cache/busy

### Plugin 70 — confirmation dan close

- Interactive agent fallback memakai `executeTool`, jadi confirmed close dari agent
  sudah mendapat D1/D2/F9.
- `/closeall` adalah explicit command dan saat ini tidak melewati dialog
  `_pendingConfirmation`; ini perilaku existing dan tidak diubah oleh 7.9.
- `/closeall` memanggil `runtime.closePosition` langsung. Akibatnya ia melewati
  `executeTool` notification, recorded-field selection, auto-swap, dan tool logging.
- Core Telegram handler memang mengantre command bila `_managementBusy`,
  `_screeningBusy`, atau agent `busy`. Namun setelah `/closeall` mulai, Plugin 70
  tidak mengangkat salah satu busy flag; poller dapat mulai di tengah loop close-all.
- Rekomendasi minimum: route tiap close melalui `runtime.executeTool`; untuk mutex
  lintas seluruh loop diperlukan core-owned money-action hook/lock, yang lebih besar
  dari scope dan perlu keputusan owner. Tanpa lock tambahan, per-position state close
  masih idempotent-ish tetapi ada race nyata dengan poller.

### Plugin 80 — afterCycle

- Installed core menjalankan `management:afterCycle` sekali setelah `finally`.
- Plugin 80 adalah owner tunggal `maybeFireLearningReport`.
- Jangan port fork `await maybeFireLearningReport()`; itu akan dobel milestone hook.
- Hook berjalan setelah `_managementBusy=false`, sama urutan umumnya dengan fork;
  ia read/report-only dan fail-open.

### Cache/screening 7.8

- Post-management `runScreeningCycle()` tetap satu choke point.
- Patch 32 mengangkat `_screeningBusy` di core, lalu Plugin 90 mengambil alih cycle.
- Plugin 90 dan Plugin 70 berbagi `zenpack-lib/candidate-cache.js`; tidak ada cache
  lokal kedua.
- PnL poller guard `_screeningBusy` mencegah close saat screening plugin aktif.
- `_pollTriggeredAt` tidak diperlukan dan tidak boleh muncul kembali; candidate
  cache tidak bergantung padanya.

### Busy ownership vanilla

- Management cron: `runManagementCycle` owner `_managementBusy`.
- PnL poll: `_pnlPollBusy`, plus `_managementBusy` hanya selama confirmed direct close.
- Screening: core `_screeningBusy`, Plugin 90 hanya body cycle.
- Health: `_managementBusy`.
- Plugin 70 `/closeall`: belum punya core money mutex (hidden race di atas).

## 8. Build map usulan B/C/D (belum dijalankan)

1. Patch baru via `lib/patcher.js` untuk `state.js`:
   - import `config`;
   - replace `trackPosition` block dengan factory/ensure block gabungan;
   - sisip trough + price excursion ke `updatePnlAndCheckExits` tanpa menyentuh
     body `confirmPeak`/`registerExitSignal`.
2. Patch `tools/dlmm.js` import + call `ensureDeployedAt`.
3. Patch paper close return `peak_pnl_pct: tracked.peak_pnl_pct ?? null` agar test
   notif paper sesuai brief. Ini adalah requirement-derived insertion, bukan baris
   fork (fork paper return juga belum membawanya); owner harus menyetujui deviasi
   kecil ini.
4. Jika owner setuju hidden-gap Plugin 70: route `/closeall` lewat `executeTool`.
   Mutex lintas loop dipisahkan sebagai keputusan eksplisit; jangan diam-diam
   mengekspor `_managementBusy`.
5. Tidak ada perubahan ke `index.js` poller/management selain bila golden harness
   butuh seam test non-production. Prefer test source extraction/mocks tanpa seam.

## 9. Gate money yang harus dibuktikan setelah approval

- Paper dua lapis: unit/harness mocked + install sandbox lifecycle nyata.
- ZERO-TX: spy seluruh write sink; paper close/auto-swap tidak mengirim transaksi.
- Golden 2-tick: oracle pristine `5ab14b4` vs installed dengan fitur tambahan tidak
  memengaruhi sequence `confirmPeak/registerExitSignal/close`; tick 1 no close,
  tick 2 exactly one direct close.
- Raw diff: `confirmPeak`, `registerExitSignal`, dan poller vanilla 721–776 identik
  terhadap golden; allowlist hanya import/producer/consumer additions yang disetujui.
- State lifecycle: paper/live record mempunyai `deployed_at`, trough/peak dan raw
  price excursion; retrack tidak mengubah timestamp.
- Backfill: untracked on-chain record diadopsi sekali, note jujur tersimpan.
- Close notif: `peakPnlPct`, F9 recorded PnL, reason/lesson/fees.
- Auto-swap: retry dan failure fail-open; close tetap success.
- Busy: satu close per tick dan tidak overlap management/screening.
- Siklus install -> test -> uninstall/migration -> reinstall; seluruh suite hijau.
- Golden diff + raw diff + push hanya setelah konfirmasi eksplisit owner.

## 10. Pertanyaan checkpoint untuk owner

1. Setujui build minimum state + `ensureDeployedAt` call-site, dengan mesin 2-tick
   dan seluruh poller/index exit tetap untouched?
2. Setujui deviasi requirement-derived satu baris pada paper close return untuk
   `peak_pnl_pct`, meski baris itu tidak ada di fork `643e954`?
3. Untuk Plugin 70, pilih:
   - minimum: `/closeall` memakai `executeTool` agar D1/D2/F9 konsisten; atau
   - minimum + mutex core lintas close-all (scope lebih besar); atau
   - defer Plugin 70 dan terima bahwa `/closeall` tetap bypass post-hook.
4. Konfirmasi residu fork di luar paket tetap DROP: idle cooldown mechanism,
   paper pool-memory guard, indicator exit mechanism, `recordRebalance`, dan semua
   UI/report refactor management.

Sampai jawaban owner: **STOP.**
