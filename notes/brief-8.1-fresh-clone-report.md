# BRIEF 8.1 — fresh-clone verification

Date: 2026-07-19 (Asia/Shanghai)
Pack: `37e136050d63080fb017c187f1ed2a965096197d`
Vanilla: `5ab14b476e4e8d25c58f989c77b161721e1a505f`
Target: `/home/ubuntu/meridian-lab/fresh-81`
Golden output reference: `/home/ubuntu/meridian-lab/golden-reference`
Fork behavior reference: `/home/ubuntu/meridianzen@643e954`

## Verdict

**⚠️ STOP before 8.2.** The installed Zen feature surface passed, but the literal
fresh path `git clone` + pack `install.sh` is not bootable by itself because the
fresh clone has no dependencies and pack `install.sh` is copy+patch only. The
first boot ended at `ERR_MODULE_NOT_FOUND: node-cron`. Boot passed after the
upstream-documented `npm install` prerequisite. `npm ci` was also unusable
because vanilla's lockfile lacks `utf-8-validate@5.0.10`.

No fix was made. This phase remains measurement-only.

## 8.1-A — pristine environment

- Clone was created at the requested external target and detached at exact SHA
  `5ab14b4`.
- Pack was clean and at exact HEAD `37e1360` before testing.
- Installer exited 0 and registered 51 manifest entries.
- Patch output: 6 `appended`, 21 `patched`, 173 `replaced`, 4
  `skipped-idempotent`; zero `old-not-found`, rollback, syntax failure,
  collision, or other failed/skipped-because-failure result. The four
  idempotent skips are same-run already-present forms, not failed anchors.
- Installed plugin inventory is exactly 10 files (`00` through `90`).
- After `npm install`, bounded DRY_RUN boot reported:
  `[zen-pack] loaded 10 plugins (skipped 0, errors 0)`.
- The two boot-time OpenRouter 401 lines are the documented dummy-key baseline
  in `tests/fixtures/env.dummy`; no wallet transaction was attempted.
- No live bot and no PM2 command was run.

Full installer, boot, and test output are retained beside this report:

- `brief-8.1-install.full.log`
- `brief-8.1-boot.full.log`
- `brief-8.1-tests.full.log`
- `brief-8.1-extra-surface.full.log`
- `brief-8.1-integrity.full.log`

## 8.1-B/C — full checklist

Legend: `golden text` means one of the four read-only golden 0.4 output files;
`fork parity` means executable/structural comparison with committed fork
`643e954`; `surface` means direct hook invocation on the installed fresh target.

| Feature | Result | Golden/reference | Notes |
|---|---:|---|---|
| Fresh clone + exact checkout | ✅ | locked vanilla SHA | Detached HEAD exactly `5ab14b4`; old `vanilla-test` unused. |
| Pack installer copy/drop-ins/patches | ✅ | pack manifest + patch gates | Exit 0; 51 manifest paths; no failed patch operation. |
| Literal clone + `install.sh` boot | ⚠️ | stated BRIEF claim | Missing dependencies (`node-cron`); requires separate vanilla `npm install`. STOP before 8.2. |
| DRY_RUN plugin boot | ✅ | loader contract | 10 loaded, 0 skipped, 0 plugin errors after vanilla dependency install. |
| Telegram `/help` | ✅ | fork surface | Handled; command list includes `/report` and `/guide`. |
| Telegram `/guide` | ✅ | fork surface | Handled; guide TOC rendered. |
| Telegram `/status` | ✅ | `status.txt` | Wallet, realized/net, and system sections retained; performance/insight remain conditional on history. |
| Telegram `/wallet` | ✅ | status wallet substance | Installed renderer handled command; paper wallet fixture only. |
| Telegram `/positions` | ✅ | `positions.txt` | Empty-state substance equal (`No open positions`); fresh redesign adds icon. |
| Telegram `/pool` | ✅ | fork surface | Empty-position invalid-number branch handled gracefully. |
| Telegram `/config`, `core`, `origin` | ✅ | `config.txt` | Same substantive groups/keys; defaults differ because fresh has no golden user's racikan. |
| Telegram `/settings` landing | ✅ | `settings.txt` | Same summary and functional-group landing substance; redesign accepted. |
| Settings sizing page | ✅ | `config.txt` sizing | Direct callback handled; non-empty rendered output. |
| Settings screening page | ✅ | `config.txt` screening | Direct callback handled; non-empty rendered output. |
| Settings GMGN page after gate removal | ✅ | `config.txt` GMGN | Direct callback handled without source gate; 1,326-char page rendered. |
| Settings exit page | ✅ | `config.txt` exit | Direct callback handled. |
| Settings strategy page | ✅ | `config.txt` strategy | Direct callback handled. |
| Settings indicators page | ✅ | `config.txt` indicators | Direct callback handled. |
| Settings schedule page | ✅ | `config.txt` schedule | Direct callback handled. |
| Settings LLM page | ✅ | `config.txt` LLM | Direct callback handled. |
| Settings Darwin page | ✅ | `config.txt` Darwin | Direct callback handled. |
| Settings reports page | ✅ | `config.txt` reports | Direct callback handled. |
| Settings experiments page | ✅ | `config.txt` experiments | Direct callback handled. |
| Settings infra page | ✅ | `config.txt` infra | Direct callback handled. |
| Settings presets page | ✅ | fork surface | Direct callback handled. |
| Telegram `/preset` family | ✅ | fork parity | Empty list, save, show, use, remove, and unknown-subcommand usage passed. |
| Telegram `/export racikan` | ✅ | fork surface | Empty-racikan path handled gracefully. |
| Telegram `/export profil` | ✅ | fork surface | Dummy profile export created under disposable target. |
| Telegram `/addprofil` | ✅ | fork surface | Usage and dummy scaffold paths passed. |
| Telegram `/candidates` | ✅ | fork parity | Shared cache ownership and rendering passed. |
| Telegram `/screen` | ✅ | fork parity | Command handled by money/screening plugin. |
| Telegram `/briefing` | ✅ | fork parity + surface | Dummy briefing rendered with no live network. |
| Telegram `/briefing alltime` | ✅ | fork parity | Generated/pinned new report, unpinned previous fixture ID. |
| Telegram `/report` | ✅ | fork parity | Default and `setups` HTML paths handled. |
| Telegram `/hive` | ✅ | fork surface | HiveMind view includes agent ID. |
| Telegram `/wallet trackstart` | ✅ | fork surface | Set/show/off cycle passed and fixture state restored. |
| Telegram `/closeall` paper | ✅ | fork parity | Sol-mode-aware PnL tree rendered; no live close. |
| REPL guide | ✅ | shared hook surface | Direct `repl:command` handled and rendered. |
| REPL preset | ✅ | shared hook surface | Direct `repl:command` handled and rendered. |
| REPL addprofil | ✅ | shared hook surface | Usage branch handled without creating a profile. |
| REPL export | ✅ | shared hook surface | Racikan export response handled. |
| REPL report | ✅ | fork parity | Shared hook handled; HTML stripped for stdout. |
| REPL briefing | ✅ | shared hook surface | Dummy briefing handled and rendered. |
| Full paper screening cycle | ✅ | fork lifecycle parity | 12/12; five-stage GMGN producer, lifecycle adapter, fake-deploy override, ZERO-TX. |
| Full paper management surface | ✅ | fork parity | Hard-rule/indicator/claim precedence, close routing, idle trigger, paper lifecycle and `/closeall` passed. |
| ZERO-TX | ✅ | explicit counters | Screening, deploy, close, indicator, update-config all reported zero transaction calls. |
| `update_config` split persistence | ✅ | fork + PRA-8 declared deltas | GMGN-only, user-only, and mixed writes landed in canonical files. |
| Config reload | ✅ | config reload hook | GMGN arrays and Zen keys retained after reload. |
| Restart retain | ✅ | subprocess restart | GMGN array survived a fresh Node subprocess/plugin reload. |
| Golden text substance | ✅ | four golden 0.4 files | Format/default values differ by redesign/fresh fixture; sections and behavior are substantively present. |
| Golden read-only | ✅ | SHA-256 + metadata snapshots | Before/after content hashes, sizes, and mtimes are byte-identical. |
| Pack/fork write isolation | ✅ | Git status/raw diff | Pack stayed clean until these notes; fork retained exactly its four pre-existing dirty files. All install/runtime writes are under external `fresh-81`. |

## Golden deltas

### Recorded/expected deviations

- Fresh fixture has no `mainzen_v2_1` racikan, live wallet, or 329-trade history;
  values therefore differ while the renderer sections and field substance remain.
- Output redesign differences (icons, separators, split messages/pages) are display
  deltas already allowed by the brief.
- PRA-8 parity test reports the declared exceptions only:
  marker 1, baseline keys 13, array normalization 4, corrupt-GMGN fail-closed 1,
  and executable definition-name corrections 3.
- Four installer `skipped-idempotent` results are already-present forms produced
  by earlier patch steps in the same clean installation, not failed patch anchors.

### New finding

- **Fresh boot path dependency gap:** pack `install.sh` does not install vanilla
  dependencies. Literal clone + pack installer cannot boot. Upstream `npm install`
  succeeds, but `npm ci` fails because the committed lockfile is out of sync.
  No repair was attempted.

## Test totals and isolation

- Pack smoke plus 30 installed-target `.mjs` gates: all exit 0.
- Telegram command suite: 26/26.
- Settings installed suite: 5/5 plus 14 direct page callbacks.
- Update config: 11/11, `ZERO-TX:0`.
- Screening cycle: 12/12, ZERO-TX.
- Stage 7.10 management/display: 8/8, ZERO-TX.
- Additional direct surface probe: PASS.
- Dummy wallet/keys only. No live secret was supplied.
- `fresh-81` is disposable and outside the pack/fork repositories.

## Raw-diff conclusion

The fresh target contains the expected patched vanilla files, drop-ins, `.zenpack`
backups/manifest, and disposable test/runtime artifacts. `package-lock.json` changed
only because upstream `npm install` repaired its missing lock entry. No installed
code or runtime artifact was written into the pack or fork. The only pack changes
created by this phase are the committed report/log notes listed above.
