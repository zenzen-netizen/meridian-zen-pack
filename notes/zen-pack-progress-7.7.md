# Stage 7.7 — briefing orchestration and boot wiring

## 7.7-A — recon and owner decisions

- Source of truth: fork `643e954:index.js`, vanilla `5ab14b4`.
- Hidden dependencies found and owner-approved: `persistConfigChange`, six
  persisted briefing dedup helpers, and export of the existing
  `racikanScopeDisclosure` from Plugin 30.
- There is no briefing field in the local `timers` object. Daily sent date,
  pinned message, learning milestone, and weekly/monthly keys are persisted in
  `state.js`; `_cronTasks` owns cron lifecycle only.
- Vanilla briefing task, watchdog, and both TTY/non-TTY boot catch-up calls all
  route through local `runBriefing`. Patch 30 therefore adds a handled hook at
  that choke point and leaves the original body as uninstall/failure fallback.
- Learning-report call-site is the unique junction after `runManagementCycle`
  fully settles and before its return. The hook is independently catch-wrapped;
  report failure cannot change cycle actions or its result.
- REPL has a clean anchor immediately after `/stop`. A new `repl:command` hook
  avoids reusing Telegram display handlers that would send to Telegram instead
  of stdout.

## 7.7-B — Plugin 80 and commands

- Added `80-briefing-orch.js` with the eight scoped fork functions. Function
  bodies are byte-identical after ignoring the additive `export` keyword.
- `/briefing`, `/briefing alltime`, and `/report [arg]` are handled on Telegram.
  REPL uses the same command functions with plain stdout rendering.
- Plugin 10 shares `/guide`, `/preset`, `/addprofil`, and `/export` handlers
  across Telegram and REPL. Existing vanilla `/learn` remains the fallback.
- Plugin 30 now exports its existing disclosure helper; no duplicate exists.

## 7.7-C — Patch 30 wiring

- `config.js`: fork-verbatim `persistConfigChange`. Stage 5.2 debt is partially
  paid for this consumer; update_config split-persistence remains separate.
- `state.js`: fork-verbatim briefing pin, milestone, and periodic key getters and
  setters. Trough/peak/deployed_at state remains debt for 7.8/7.9.
- `index.js`: briefing override hook with vanilla fallback; fail-open
  `management:afterCycle`; Monday 01:30 UTC and month-day-1 02:00 UTC tasks;
  weekly/monthly membership in `_cronTasks`; `repl:command` stdout hook.
- Opportunity poller and vanilla confirmTicks/registerExitSignal exit engine are
  unchanged. Screening throttle and emergency/direct-close fork regions were not
  ported.

## 7.7-D — gate

- New fixture suite `briefing-orch.test.mjs`: 7/7. It covers alltime send/pin/
  previous-unpin, `/report setups`, shared REPL handling, exact UTC schedules,
  periodic persisted dedup, auto-tune OFF byte-noop, and auto-tune ON persistence
  using eight real gas fixtures. All data and Telegram transport are isolated.
- Full installed harness and npm smoke pass. Loader inventory is 9 plugins.
- Cycle passed: all 22 tracked backups restored hash-clean; sandbox returned to
  exact `5ab14b4`; vanilla Telegram/settings parity passed; fresh install passed;
  second install reported all seven Patch-30 operations skipped-idempotent.
- Boot gate: DRY_RUN, 9 loaded, 0 skipped, 0 errors, expected dummy-auth 401,
  graceful SIGTERM with zero positions.
- Golden: eight Plugin-80 functions, `persistConfigChange`, and six state helpers
  match fork byte-for-byte. Raw audit: Patch 30 7/7 replacements occur once;
  22/22 backups equal HEAD; 48/48 copied files equal pack; unknown untracked 0.
  Opportunity poller and the vanilla 2-tick engine remain present; 7.8/7.9
  symbols remain absent.
- No live bot was restarted and no live transaction path was used. Scoped test
  artifacts under sandbox `exports/`, `presets/`, and `sol-balance-history.json`
  were removed after the gate; installed pack files remain.
