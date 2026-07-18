// zenpack-lib/sizing.js — fungsi sizing custom fork, diekstrak dari config.js VERBATIM
// (fork config.js:498-558 min/computeDeployAmount, :572-582 applyConvictionSizing). Modul terpisah
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
// persistConfigChange tetap di luar scope; konsumen computeDeployAmount 7.6 adalah plugin 70.
import { config } from "../config.js";

export function minDeployAmount() {
  return Math.max(0.03, config.management.deployAmountSol ?? 0.03);
}

export function computeDeployAmount(walletSol, opts = {}) {
  const reserve  = config.management.gasReserve      ?? 0.2;
  const ceil     = config.risk.maxDeployAmount;

  if (config.management.sizingMode === "maximize") {
    const rent     = Math.max(0, config.management.rentPerPositionSol ?? 0);
    const maxSlots = Math.max(1, Math.floor(opts.slotsRemaining ?? config.risk.maxPositions ?? 1));
    const min      = minDeployAmount();
    // ADAPTIVE SLOTS. perSlot = (wallet − gas − rent×N)/N decreases monotonically
    // as N grows (more rent reserved + a smaller share each), so the LARGEST N that
    // still keeps every slot ≥ min opens as many positions as possible without any
    // falling under the floor. Iterate N down from the open slots; take the first
    // that clears min. If even a single position can't reach min (wallet too small),
    // return 0 — an explicit "can't deploy" signal. Returning a sub-min amount was
    // the stuck-retry bug: the deploy safety check rejects it, the LLM retries, the
    // cycle burns. 0 lets callers skip cleanly instead.
    for (let n = maxSlots; n >= 1; n--) {
      const deployable = Math.max(0, walletSol - reserve - rent * n);
      const perSlot    = Math.floor((deployable / n) * 1000) / 1000; // never round UP
      if (perSlot >= min) return Math.min(ceil, perSlot);
    }
    return 0;
  }

  const pct        = config.management.positionSizePct ?? 0.35;
  const floor      = config.management.deployAmountSol;
  const deployable = Math.max(0, walletSol - reserve);
  const dynamic    = deployable * pct;
  const result     = Math.min(ceil, Math.max(floor, dynamic));
  return parseFloat(result.toFixed(2));
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
