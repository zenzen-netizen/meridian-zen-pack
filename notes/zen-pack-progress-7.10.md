# Stage 7.10 — final residue closure and Stage 8 handoff

## Owner-locked result

- Patch 34 ports the fork's indicator-exit import, management-cycle call-site,
  helper, and idle zero-position cooldown verbatim. Indicator exit remains
  default-OFF and sits after hard deterministic exits but before CLAIM. Idle
  cooldown keeps the fork defaults exactly: `false` and 20 minutes.
- Patch 35 ports all four remaining Jupiter symbol/display hunks in
  `tools/pnl.js`. It changes pair labelling only; PnL arithmetic remains equal to
  the pristine vanilla backup.
- `/set` and `/setcfg` display wording is dropped; their existing note/config
  write paths remain active. Executor block 6 is dropped because the management
  cycle and two-tick poller already converge on `executeTool("close_position")`,
  whose local D1 retry covers close and claim.
- Vanilla `dev-blocklist.js` fail-closed behavior is retained as conscious
  deviation #4. **Stage 8.4 MUST validate a blocklist fetch/read failure on a live
  receh deployment. Until that observation passes, the guard may stop deployment
  and MUST NOT be called safe.**

## Single final inventory

| Class | Final Stage 7 inventory | Stage 8 handoff / status |
|---|---|---|
| Patch (46) | `01`, `02`, `03a/b`, `04a/b`, `05`–`23`, `25a/b/c`, `26a/b`, `27`–`35` as listed canonically in `manifest.json`; Patch 27 is superseded in place by the full PRA-8 handler | Installed only through the registered patch runner; pristine and legacy-Patch-27 targets converge, fresh replay reproduces the target diff, and repeat replay is idempotent. No manual/wild core delta. |
| Plugin (10) | `00-zenpack-hello`, `10-telegram-cmds`, `20-profile-tools`, `30-render-views`, `40-prompt-racikan`, `50-config-ext`, `60-settings-menu`, `70-money-commands`, `80-briefing-orch`, `90-screening-cycle` | All load in sandbox: 10 loaded, 0 skipped, 0 errors. Plugin 50 owns GMGN migration/boot/reload; Plugin 60's temporary GMGN edit gate is removed. |
| Drop-in (51) | 6 `zenpack-lib`, 10 `zenpack-plugins`, 18 root modules, 12 views, 1 tool, 3 scripts, 1 guide | 51/51 installed bytes equal pack sources. Modified upstream docs/examples remain deliberately undistributed. |
| Baseline delta #1 | Vanilla opportunity poller remains active although absent from fork | Mandatory Stage 8.4 live-receh validation remains. |
| Baseline delta #2 | Vanilla `degenScore` remains because the opportunity poller consumes it | Keep with #1 unless that poller is retired. |
| Baseline delta #3 | Vanilla two-tick confirmation engine remains; fork 15-second queue, `_pollTriggeredAt`, and `emergencyCloseDirect` stay dropped | Golden full poller is byte-identical to vanilla and behavior is locked tick-1 no-fire / tick-2 fire. |
| Baseline delta #4 | Vanilla `dev-blocklist.js` remains fail-closed instead of fork fail-open | **MANDATORY Stage 8.4 live-receh failure visibility test.** A failed fetch/read can hold deployment; do not declare safe before evidence. |
| Baseline transport/safety | DLMM keeps `agent-meridian.js`, instruction-key fallback, relay-disabled comment, and dynamic `node-fetch` fallback; agent cost recording is always-on and GENERAL defaults to 8192 tokens | Conscious upstream/safety deltas; preserve unless their consumers are redesigned. |
| Adaptation | Hook/plugin ownership for Telegram, briefing, screening, render, and prompt; shared candidate cache; paper `peak_pnl_pct`; config/path routing; test-only dependency seams | These are installation boundaries, not fork residues. Keep adapters narrow and golden against fork-owned bodies. |
| DROP | `/set` + `/setcfg` cosmetic display delta; executor block 6 owner swap; old 15-second/emergency engine; dead/comment-only fork helpers and packaging artifacts classified in the 7.10-A ledger | No Stage 8 port. Reopen only for a new functional consumer or explicit owner override. |
| PRA-8 paid | Executor block 1 `update_config`: 181-key handler, GMGN split persistence, `paths` routing, flat definitions/schema, validation/redaction/migration, complete GMGN boot/reload, and removal of Plugin 60 GMGN menu gate | Closed as one coupled workstream. Patch 27 old additive form is explicitly superseded; migration remains sandbox-only until staged live rollout. |
| Baseline delta #5 | Existing corrupt `gmgn-config.json` fails closed before runtime mutation/write instead of fork fallback to `{}` | **MANDATORY Stage 8.4 live-receh visibility/no-overwrite/deploy-held test.** Do not declare safe before evidence. |
| Conscious fixes | Four GMGN list keys normalize to arrays so values survive restart; three dead definition names are replaced by handler/schema-live names | Latent fork bugs found PRA-8, not pack regressions. Exact evidence and measured golden exceptions are in `notes/pre-8-update-config-closure.md`. |
| Stage 8 decision debt | `tools/study.js` direct-fetch fork versus vanilla `agent-meridian.js` routing; Plugin 70 `/closeall` mutex/executeTool reroute remains post-v1.0.0 safety backlog | Decide transport first; `/closeall` remains fork-verbatim until explicitly reopened. |

## Final gates

- All 30 `tests/*.test.mjs` passed, including Stage 7.10's 8/8 paper gate:
  hard-rule precedence, indicator confirmed/unconfirmed/error, two-layer paper
  close, idle OFF/ON/expiry/error, golden snippets, golden PnL, and ZERO-TX.
- `npm test` smoke passed. Full uninstall restored exact vanilla `5ab14b4` with
  empty porcelain; vanilla command/settings parity passed; fresh install and
  immediate second install passed idempotently.
- Raw ownership: 23/23 backups equal vanilla HEAD, 50/50 copied files equal pack
  sources, and `git diff --check` is clean. The installed `index.js` diff was
  freshly regenerated by registered patches only. Forbidden 15-second/emergency
  symbols remain absent and the vanilla poller remains byte-identical.
- DRY_RUN dummy boot loaded 10 plugins with zero skips/errors, started cron, and
  shut down with zero open positions. The dummy-key 401 is expected. No live bot
  restart and no live transaction occurred.

## PRA-8 update_config addendum

- All 33 `tests/*.test.mjs` pass after the coupled workstream. Migration is 7/7,
  update_config is 11/11 with `ZERO-TX:0`, settings menu is 5/5, and config
  boot/reload is 16/16. `npm test` smoke remains green.
- Golden exceptions against fork `643e954` are measured exactly: marker 1,
  retained baseline keys 13, normalized arrays 4, fail-closed block 1, and dead
  definition-name corrections 3. No other handler/definition drift remains.
- Lifecycle passes old-Patch-27 upgrade, uninstall to exact `5ab14b4` with empty
  porcelain, fresh install, immediate idempotent reinstall, backup raw diff
  23/23, and drop-in raw diff 51/51.
- Live configs and PM2 processes remain untouched. Stage 8.4 must execute the
  real per-profile migration and validate conscious deviation #5 on the smallest
  bot before wider migration.
