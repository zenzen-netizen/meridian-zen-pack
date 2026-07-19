# Stage 7.9 — exit lifecycle fields on vanilla confirmation

## Owner-locked scope

- Port minimum fork state record, `ensureDeployedAt`, trough PnL, and price
  excursions onto vanilla's existing two-tick engine.
- Add `peak_pnl_pct` only to the paper-close return as a pack-side shape-fidelity
  adaptation. The live close path is unchanged.
- Keep Plugin 70 `/closeall` verbatim fork: direct close and PnL summary, without
  a new mutex or `executeTool` reroute. Those safety changes remain post-v1.0.0.
- Drop the fork 15-second confirmation engine, emergency direct-close helper, and
  `_pollTriggeredAt`. Indicator-exit and idle-screening cooldown remain explicit
  extraction debt for 7.10/pra-8; exact call-sites are recorded in
  `notes/stage-7.9-recon.md`.

## 7.9-B — minimum build

- Patch 33 replaces the state record factory/track block with fork metadata and
  `ensureDeployedAt`, while retaining the vanilla confirmation fields.
- The excursion update is inserted before the untouched trailing/confirmation
  body. `tools/dlmm.js` imports and calls `ensureDeployedAt` for fallback on-chain
  positions and returns paper `peak_pnl_pct`.
- Patch 19c and 20e gained migration-aware `already` anchors for the final Patch
  33 paper block/import shape. This fixes strict reinstall without changing
  runtime behavior.

## 7.9-C — dedicated regression harness

- `exit-state.test.mjs`: installed `confirmPeak`, `registerExitSignal`, and the
  complete fast PnL poller are byte-identical to the pristine backup; tick 1 does
  not fire and tick 2 fires exactly once.
- Record creation/retrack/backfill verifies persistent `deployed_at`, trough and
  price excursions, suspicious-PnL behavior, and idempotent unknown-position
  adoption.
- Paper lifecycle verifies `peak_pnl_pct: 7.5` on close and `ZERO-TX: 0`.
- Wallet retry exhaustion returns fail-open without throwing into the close
  caller. Existing management close routing continues to own D1/D2/F9.

## 7.9-D — full money gate

- Final installed harness: all 29 `tests/*.test.mjs` pass; `npm test` smoke passes.
  Paper OFF yields `diff: []`; paper ON completes deploy/list/PnL/close and reports
  `ZERO-TX: 0`. Money command regression remains 13/13, including unchanged
  `/closeall` rendering.
- Lifecycle: uninstall restored exact vanilla `5ab14b4` with empty porcelain;
  vanilla settings parity passed 1/1. Fresh install applied Patch 33 6/6; repeat
  install skipped Patch 19c 1/1, Patch 20e 9/9, and Patch 33 6/6 idempotently.
- Golden: `confirmPeak`, `registerExitSignal`, and the vanilla two-tick poller are
  byte-identical to their pre-install backups. All forbidden 15s, emergency, and
  cooldown symbols are absent.
- Raw diff: `git diff --check` passes; all 23 patched-file backups are byte-equal
  to vanilla HEAD and all 50 manifest-owned drop-ins are byte-equal to pack
  sources. State/DLMM diff contains only approved lifecycle/record consumers plus
  earlier stage fields; no confirmation/poller delta exists.
- DRY_RUN sandbox boot loaded 10 plugins with 0 skipped/errors, started cron, and
  shut down with 0 open positions. Timeout exit 124 is expected. No live restart
  or live transaction was performed.

