# FASE 5.5 executor.js — FASE A recon (anchor presisi + peta pemisahan)

Target: `vanilla-test/tools/executor.js` (main, 909 baris). Fork: `fork-ref/tools/executor.js` (1104 baris). Diff = 622 baris (fork jauh menyimpang; hanya 7 blok in-scope).

## Ringkas verdict
- **Config surface SIAP** — 5.1 config-ext (`50-config-ext.js`) sudah definisikan semua key blok 1–4: `strategy.strategyLock` (default "default", L73), `management.rentPerPositionSol` (default 0, L69), `config.experiments.{exitLiquidityCheck,convictionSizing,convictionSizingMaxAdjustPct,...}` (L102). Tidak ada blocker config.
- **Deploy case (runSafetyChecks) byte-identik fork vs vanilla KECUALI blok sisipan** → blok 2/3/4 **bisa dipisah bersih** (anchor beda, tak tumpang-tindih). Dataflow conviction→blok4 lewat `args`, bukan struktur kode. TAK ada anchor ganda/absen (semua count=1).
- **Blok 5 & 6 DEFER 5.7** — dep `wallet.js` absen di vanilla-test. Brief STOP-condition A.3 terpenuhi.

## Anchor presisi 7 blok (SEMUA count=1 di vanilla-test)

| Blok | Sifat | Anchor vanilla (executor.js) | NEW (fork) | Status |
|---|---|---|---|---|
| 1 update_config | non-money, REWRITE besar | handler `update_config: ({ changes, reason="" }) =>` L343–~465 | fork `update_config: (args={})` L300–660 (sig beda + VALID_LOCKS strategyLock + schema-validate + ~50 CONFIG_MAP) | PORT 5.5 (1 replaceLine blok besar, self-contained toolMap entry) |
| 2 strategyLock override | ⚠️ MONEY | insert di case-top, sebelum `const poolThresholds = await validateDeployPoolThresholds(args);` (case `deploy_position` count=1) | fork L861–871 | PORT 5.5 |
| 3 applyConvictionSizing | ⚠️ MONEY | insert sebelum `// Reject pools with bin_step out of configured range` (count=1) | fork L877–894 (import sizing.js) | PORT 5.5 |
| 4 minDeploy + rent | ⚠️ MONEY | 4a: replaceLine `const minDeploy = Math.max(0.1, config.management.deployAmountSol);` (count=1) → `minDeployAmount()`. 4b: blok `// Check SOL balance` L858–868 (count=1) → tambah rentReserve | fork L1005 + L1023–1035 | PORT 5.5 |
| 5 exitLiquidityCheck | ⚠️ MONEY | append sebelum `return { pass: true };` (case deploy) | fork L1042–1063; pakai `quoteSellPriceImpact` | **DEFER 5.7** (dep absen) |
| 6 auto-swap base→SOL | ⚠️ MONEY | close path executeTool | fork L809–819; pakai `swapBaseToSolWithRetry` (wallet.js) | **DEFER 5.7** (dep absen; vanilla PUNYA versi lokal `swapBaseToSolWithRetry` L607 → tunda tanpa rugi fungsi) |
| 7 notify peakPnl | display | replaceLine `notifyClose({ pair..., pnlUsd..., pnlPct... })` L683 (count=1) | fork L803 (+peakPnlPct, recorded_pnl fallback, reason, lesson, feesUsd) | PORT 5.5 (cek telegram.js abaikan field asing) |

## sizing.js (FASE B target)
`zenpack-lib/sizing.js` — verbatim fork config.js:
- `minDeployAmount()` L498–500: `return Math.max(0.03, config.management.deployAmountSol ?? 0.03);` ⚠️ floor 0.03 vs vanilla inline 0.1 = **perubahan perilaku money (verbatim fork, sesuai brief)**.
- `applyConvictionSizing(amountSol, conviction)` L572–582: clamp ke [deployAmountSol, maxDeployAmount], fail-safe (mult=1 kalau off/medium/missing).
- Deps: `config.management.deployAmountSol`, `config.risk.maxDeployAmount`, `config.experiments?.convictionSizing` (optional-chain, fail-safe).
- Executor import (fork L23) HANYA 2 fn ini. `computeDeployAmount` + `persistConfigChange` = **DEFER 7.x** (executor tak pakai — terbukti).
- `MIN_SAFE_BINS_BELOW` = SUDAH ada vanilla config.js:16 (exported) + diimport executor.js:23. TIDAK perlu ke sizing.js.

## Dep gate (FASE A.3) — bukti
- `grep swapBaseToSolWithRetry\|quoteSellPriceImpact vanilla-test/tools/wallet.js` → **NONE**. Di fork-ref/wallet.js: quoteSellPriceImpact L185, swapBaseToSolWithRetry L362 (sig `{base_mint,attempts,backoffMs}`).
- Vanilla-test executor PUNYA `swapBaseToSolWithRetry(baseMint, label)` LOKAL (L607) + config autoSwapRetry* → auto-swap after close SUDAH jalan bentuk lain. Fork = refactor ke wallet.js. Tunda blok 6 = nol rugi fungsi.

## STOP status
- Hard-STOP: anchor ganda/absen = NONE ✅ · money dipisah bersih = YA ✅.
- Brief STOP A.3 (blok 5/6 wallet.js absen) = **TERPENUHI** → DEFER 5.7, lapor owner sebelum FASE B.
