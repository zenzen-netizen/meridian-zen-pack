# Audit Pack G0, Fase A3 item-3 — recon runtime VPS (READ-ONLY)

Progress tracker:
- ✅ T1 migrasi gmgn-split
- ✅ T2 kebersihan exports/
- ✅ T3 config racikan aktif

## T1 — Migrasi gmgn-split

Vonis: **SUDAH MIGRASI** (⚠️ DEVIASI dari ekspektasi brief "belum jalan")

| Cek | Hasil |
|---|---|
| `gmgn-config.json` | ADA — 75 bytes, tanggal `Jun 6 13:15` |
| Backup migrasi | `gmgn-config.json.pre-zenpack-pra8.bak` + `user-config.json.pre-zenpack-pra8.bak` ADA di root pack; juga `.zenpack/backups/`, `.zenpack/install-manifest.txt`, `.zenpack/pre-install-hashes.json` |
| `grep -c "gmgn" user-config.json` | `0` — kunci gmgn* sudah tidak ada di user-config.json |
| Log boot (migrat) | UNKNOWN — dicari di `/home/ubuntu/.pm2/logs/meridian-main-zenpack84-out.log` dan `-error.log`, nol match (log kemungkinan sudah rotate lewat tanggal migrasi Jun 6) |

Bukti: `/home/ubuntu/meridianzen-pack/gmgn-config.json`, `/home/ubuntu/meridianzen-pack/gmgn-config.json.pre-zenpack-pra8.bak`, `/home/ubuntu/meridianzen-pack/user-config.json`.

**Catat buat owner:** migrasi gmgn-split sudah kejadian (tanggal file Jun 6), tapi brief bilang "ditunda 8.4/8.5". Perlu klarifikasi apakah ini migrasi lama (pra-pack) yang wajar ada, atau migrasi tak terduga yang harus dicek ulang.

## T2 — Kebersihan exports/

Vonis: **ADA TUMPUKAN** (2 folder di pack, 2 folder duplikat di bot lama arsip; tanggal tertua isi `Jul 4`)

| Lokasi | Isi | Permission folder | Permission file |
|---|---|---|---|
| `/home/ubuntu/meridianzen-pack/exports/` | 2 folder: `profil_meridianzen_20260704-174905` (Jul 19 15:39), `racikan_mainzen_v2_1_20260704-120300` (Jul 19 15:39) | `drwxrwxr-x` (775) ⚠️ bukan 700 | Mayoritas `-rw-------` (600) OK; kecuali `racikan_mainzen_v2_1_.../preset.json` dan `MANIFEST.txt` = `-rw-rw-r--` (664) ⚠️ |
| `/home/ubuntu/meridianzen/exports/` (bot lama, arsip) | isi identik (mirror) | sama, `drwxrwxr-x` ⚠️ | sama pola ⚠️ |

**Temuan:** folder exports permission 775 (grup+other bisa masuk/list), bukan 700 seperti ekspektasi brief. File isi sensitif (state.json, user-config.json, lessons.json, dll) sudah 600 (aman), tapi 2 file racikan (`preset.json`, `MANIFEST.txt`) masih 664 world-readable.

## T3 — Config racikan aktif (receh_84)

Vonis:

| Kunci | Nilai |
|---|---|
| `activeSetup` | `receh_84` |
| `deployAmountSol` | `0.03` |
| `positionSizePct` | `0.12` |
| `sizingMode` | `fixed` |
| `stopLossPct` | `-8` |

Daftar preset di `/home/ubuntu/meridianzen-pack/presets/`:
`2-1spot.json`, `_backup.json`, `bigcapagresif.json`, `mainzen.json`, `mainzen_v2_1.json`, `mainzen_v2.json`, `receh_84.json` + `CHECKLIST-bigcap.md`, `README.md`, `ROADMAP-bigcap-experiment.md`

## Ringkasan

| Tugas | Vonis | Bukti |
|---|---|---|
| T1 migrasi gmgn-split | SUDAH MIGRASI (deviasi ekspektasi) | `gmgn-config.json` (75B, Jun 6), backup `.pre-zenpack-pra8.bak`, grep gmgn user-config = 0 |
| T2 kebersihan exports/ | ADA TUMPUKAN, 2 lokasi (pack + arsip lama), folder perm 775 bukan 700, 2 file racikan 664 | `ls -la` exports/ pack & lama |
| T3 config racikan aktif | receh_84 aktif, 5 kunci tercatat di atas | `user-config.json` grep, `presets/` listing |
