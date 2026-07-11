// Render views batch 1: /status + /positions via views/ layer (Stage 3.6).
// Blok data-fetch = VERBATIM fork-ref index.js (/status :3143-3182, /positions
// :3254-3264), diadaptasi jadi handler hook "telegram:command":
//   (a) kirim HTML lewat sendHTML (export vanilla telegram.js:160) — patch 03b TAK
//       diubah; ctx.reply hanya plain-text, jadi tak dipakai untuk view HTML.
//   (b) ctx.handled = true supaya patch 03b return sebelum handler vanilla; saat
//       pack di-uninstall handler vanilla hidup lagi (dead-path terbalik).
//   (c) DEFER subsistem yang belum ada di vanilla (fitur belum landing di pack):
//         /status: getPositionsRentSol (held), buildOpenRouterLines (orLines),
//                  formatPnlTracker+getModePerformance (pnlBlock),
//                  racikanScopeDisclosure (disclosure), condenseRule (lastGood/Bad).
//                  Semua seksi itu digerbang di views/status.js → null = seksi skip.
//                  Tersisa: Wallet + Performa + Sistem(dry-run/hive).
//         /positions: getPositionsRentSol (rentMap={} → held skip),
//                  getSolMarketRegime (solPrice=null → fail-open 1-unit).
//       Lihat notes/zen-pack-progress.md "Stage 3.6" untuk vonis dep per item.
// /wallet DILUAR scope batch 1 (view terpisah walletView) → tetap dilayani handler
// vanilla index.js (`/wallet || /status`); plugin cuma intercept /status.
import { getMyPositions } from "../tools/dlmm.js";
import { getWalletBalances } from "../tools/wallet.js";
import { config, computeDeployAmount } from "../config.js";
import { getPerformanceSummary } from "../lessons.js";
import { isHiveMindEnabled } from "../hivemind.js";
import { sendHTML, sendMessage } from "../telegram.js";
import { render } from "../views/render.js";
import * as statusView from "../views/status.js";
import * as positionsView from "../views/positions.js";
import * as systemView from "../views/system.js";
import { ICON } from "../views/format.js";

export const manifest = { name: "zenpack-render-views", priority: 100 };

// /status — komposit Wallet + Performa + Sistem (seksi fork-only DEFERRED, lihat header).
async function handleStatus() {
  const [wallet, positions] = await Promise.all([
    getWalletBalances(),
    getMyPositions({ force: true }),
  ]);
  const slotsRemaining = Math.max(1, config.risk.maxPositions - (positions?.total_positions ?? 0));
  const vm = statusView.buildView({
    cfg: config,
    sol: wallet.sol, solUsd: wallet.sol_usd, solPrice: wallet.sol_price,
    totalPositions: positions.total_positions, maxPositions: config.risk.maxPositions,
    deployAmount: computeDeployAmount(wallet.sol, { slotsRemaining }),
    gasReserve: config.management?.gasReserve ?? 0,
    heldSol: 0, heldEst: false,                              // DEFER getPositionsRentSol
    dryRun: process.env.DRY_RUN === "true", hive: isHiveMindEnabled(),
    orLines: undefined,                                      // DEFER buildOpenRouterLines
    perf: getPerformanceSummary(),
    lastGoodRule: null, lastBadRule: null,                   // DEFER condenseRule
    pnlBlock: null,                                          // DEFER formatPnlTracker
    disclosure: null,                                        // DEFER racikanScopeDisclosure
  });
  await sendHTML(render(vm, "telegram"));
}

// /positions — daftar posisi bernomor via views/positions.js.
async function handlePositions() {
  const { positions, total_positions } = await getMyPositions({ force: true });
  if (total_positions === 0) { await sendMessage(`${ICON.position} No open positions.`); return; }
  const vm = positionsView.buildView(positions, config, {}, null);  // DEFER rent + solPrice
  await sendHTML(render(vm, "telegram"));
}

export function register(hooks) {
  hooks.on("telegram:command", async (ctx) => {
    const text = String(ctx.text || "");
    if (text === "/status") {
      try { await handleStatus(); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      ctx.handled = true;
      return;
    }
    if (text === "/positions") {
      try { await handlePositions(); }
      catch (e) { await sendMessage(systemView.renderError(e.message)).catch(() => {}); }
      ctx.handled = true;
      return;
    }
    // command lain: biarkan jatuh ke rantai vanilla
  }, 100);
}
