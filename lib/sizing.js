// zenpack-lib/sizing.js — 2 fungsi sizing custom fork, diekstrak dari config.js VERBATIM
// (fork config.js:498-500 minDeployAmount, :572-582 applyConvictionSizing). Modul terpisah
// yang di-import tools/executor.js (blok 3 conviction + blok 4 minDeploy, FASE 5.5).
//
// Verbatim fork — nilai & logika TAK diubah. Floor minDeployAmount = 0.03 (fork), BUKAN 0.1
// (inline lama vanilla) — keputusan owner: ekstraksi murni, bot pack = kembar fork/live.
//
// Fail-safe dipertahankan: applyConvictionSizing kembalikan input tak-berubah saat experiment
// OFF / conviction medium/missing / input non-finite (mult=1.0 = perilaku factory).
//
// `config` = binding hidup dari config.js (objek dimutasi in-place, tak di-reassign) → baca
// nilai terkini saat fungsi dipanggil. `config.experiments` disediakan 5.1 config-ext.
//
// DEFER 7.x (executor TAK import): computeDeployAmount (maximize sizing) + persistConfigChange.
import { config } from "../config.js";

export function minDeployAmount() {
  return Math.max(0.03, config.management.deployAmountSol ?? 0.03);
}

export function applyConvictionSizing(amountSol, conviction) {
  const amt = Number(amountSol);
  if (!Number.isFinite(amt) || amt <= 0) return amountSol;
  if (!config.experiments?.convictionSizing) return amt;
  const adj = Math.max(0, Number(config.experiments.convictionSizingMaxAdjustPct ?? 30)) / 100;
  const mult = conviction === "high" ? 1 + adj : conviction === "low" ? 1 - adj : 1;
  if (mult === 1) return amt;
  const floor = config.management.deployAmountSol;
  const ceil  = config.risk.maxDeployAmount;
  return parseFloat(Math.min(ceil, Math.max(floor, amt * mult)).toFixed(2));
}
