# Zen Pack 6.6 — briefing.js full parity

Sumber kebenaran: committed fork `experimental@643e954`, dibaca dengan
`git show` dari `/home/ubuntu/meridianzen`. Bot live tidak disentuh; sandbox
hanya `/home/ubuntu/meridian-lab/vanilla-test`.

## Progress

- ✅ F0 — pre-flight
- ✅ F1 — verifikasi import + lunasi pool-memory
- ⬜ F2 — replace briefing.js byte-exact
- ⬜ F3 — gate penuh
- ⬜ F4 — manifest + tutup Stage 6

## F0 — bukti satu baris

`pack HEAD=2a29eca clean; sandbox HEAD=5ab14b4 post-6.5; briefing.js node --check PASS; installed 76 baris = vanilla committed 72 + 4 baris routing Patch 02`

## F1 — rantai import

Fork committed mempunyai 17 import module (label brief “15 modul” tidak
mengubah konten) dan 11 named import dari `reports.js` (label brief “10
fungsi” kurang satu `computeCostDragPct`). Seluruh konten exact dan tidak
ambigu.

| Modul | Binding yang dipakai briefing | Status sandbox |
|---|---|---|
| `fs` | default | stdlib hidup |
| `logger.js` | `log` | export hidup |
| `repo-root.js` | `repoPath` | export hidup |
| `paths.js` | `paths` | Patch 02/drop-in hidup |
| `lessons.js` | `getHourlyProfile`, `getModePerformance`, `getExcludedRacikanStats` | 3/3 hidup via Patch 21 |
| `config.js` | `config` | hidup |
| `openrouter-usage.js` | balance, 24h cost, credits | 3/3 hidup; byte-identik fork |
| `candidate-memory.js` | `getSkipReview` | hidup; byte-identik fork |
| `pool-memory.js` | `getDeployedPoolAddresses` | semula absen; dilunasi verbatim Patch 26a |
| `tools/wallet.js` | `getWalletBalances` | hidup |
| `gas-tracker.js` | `getGasStats` | export spesifik hidup |
| `llm-cost-tracker.js` | `getLlmCostStats` | hidup; byte-identik fork |
| `paper-trading.js` | `isPaperMode` | hidup |
| `reports.js` | 11 formatter/stat/cost exports fork L14–18 | 11/11 hidup; byte-identik fork |
| `preset-manager.js` | `formatIdentity` | hidup; byte-identik fork |
| `pnl-tracker.js` | `formatPnlTracker` | hidup; byte-identik fork |
| `views/format.js` | `SEP`, `tree` | 2/2 hidup |

### SHA-256 drop-in

| File | SHA-256 sandbox = fork |
|---|---|
| `openrouter-usage.js` | `6b2edbd16cd912cf8bb5ed7d59241bec99c6c05afe721a4eea23411bfb8ceca2` |
| `pnl-tracker.js` | `f4cb3b8b54c00bad88703fa22388956e0f9d70deaefd79194141c7536f7f6c21` |
| `preset-manager.js` | `0f9adc1ae8f75000f890503f831490be1b18fa0da7eade57ec60d2980a3d9c73` |
| `llm-cost-tracker.js` | `3b1539c88bda3b944e57b60dff351af7eb63160236043927d8eb05a5948db14b` |

Tidak ada drop-in baru yang perlu disalin. Temuan absen hanya helper
pool-memory yang sudah punya keputusan owner eksplisit untuk diport; setelah
Patch 26a seluruh rantai lengkap dan pekerjaan boleh lanjut F2.
