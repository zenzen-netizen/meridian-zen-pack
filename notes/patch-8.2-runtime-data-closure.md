# Patch 8.2 — runtime-data policy and formal cycle closure

Date: 2026-07-19 (Asia/Shanghai)

Pack basis: `a8b425e` plus this patch

Vanilla: `5ab14b476e4e8d25c58f989c77b161721e1a505f`

Disposable target: `/home/ubuntu/meridian-lab/fresh-81`

## Verdict

**✅ 8.2 CLOSED.** Runtime data is user-owned state: uninstall preserves it,
reports every existing whitelisted path, and fails only when porcelain contains
something outside that policy. The complete fresh-clone plug/unplug/plug cycle
passed with dummy credentials, DRY_RUN/paper mode, and zero transaction calls.

## Runtime-data writer audit

`manifest.json.runtime_data.entries` is the executable source of truth. A
trailing slash covers descendants; `*` covers one relative path component.

| Preserved path | Writer/path evidence |
|---|---|
| `user-config.json` | `plugins/paths.js:8`; `plugins/preset-manager.js:119`; `core-patches/snip27/update-config-NEW.txt:431` |
| `presets/` | `plugins/paths.js:15`; `plugins/preset-manager.js:31,120` |
| `gmgn-config.json` | `plugins/paths.js:16`; `core-patches/snip27/update-config-NEW.txt:435`; `lib/config-migration.js:141` |
| `state.json` | `plugins/paths.js:17`; `core-patches/02-paths-routing.mjs:13`; upstream `state.js:51` |
| `lessons.json` | `plugins/paths.js:18`; `core-patches/02-paths-routing.mjs:17`; upstream `lessons.js:71` |
| `lessons-archive-pre-mainzen_v2.json` | `plugins/paths.js:19`; `core-patches/snip21/read-NEW.txt:84` (preserved legacy runtime input) |
| `pool-memory.json` | `plugins/paths.js:20`; `core-patches/02-paths-routing.mjs:29`; upstream `pool-memory.js:42` |
| `decision-log.json` | `plugins/paths.js:21`; `core-patches/02-paths-routing.mjs:44`; upstream `decision-log.js:25` |
| `hivemind-cache.json` | `plugins/paths.js:22`; `core-patches/02-paths-routing.mjs:21`; upstream `hivemind.js:69` |
| `candidate-memory.json` | `plugins/paths.js:23`; `plugins/candidate-memory.js:19,43` |
| `signal-weights.json` | `plugins/paths.js:24`; `core-patches/02-paths-routing.mjs:41`; upstream `signal-weights.js:88` |
| `smart-wallets.json` | `plugins/paths.js:25`; `core-patches/02-paths-routing.mjs:32`; upstream `smart-wallets.js:21` |
| `token-blacklist.json` | `plugins/paths.js:26`; `core-patches/02-paths-routing.mjs:35`; upstream `token-blacklist.js:28` |
| `strategy-library.json` | `plugins/paths.js:27`; `core-patches/02-paths-routing.mjs:38`; upstream `strategy-library.js:29` |
| `sol-balance-history.json` | `plugins/paths.js:28`; `plugins/sol-tracker.js:23,40` |
| `llm-cost-log.json` | `plugins/paths.js:29`; `plugins/llm-cost-tracker.js:16,26` |
| `gas-log.json` | `plugins/paths.js:30`; `plugins/gas-tracker.js:18,26` |
| `logs/` | `plugins/paths.js:31`; `core-patches/02-paths-routing.mjs:47`; upstream `logger.js:39` |
| `exports/` | `plugins/profil-export.js:47,48,57,102`; `plugins/racikan-export.js:79,80,83,85,98` |
| `profiles/` | `plugins/addprofil.js:15,139,152,156,160,165` |
| `user-config.json.pre-zenpack-pra8.bak` | `lib/config-migration.js:11,96,98` |
| `gmgn-config.json.pre-zenpack-pra8.bak` | `lib/config-migration.js:11,96,98,138` |
| `user-config.json.zenpack-pra8-*.tmp` | `lib/config-migration.js:106,108` |
| `gmgn-config.json.zenpack-pra8-*.tmp` | `lib/config-migration.js:106,108` |
| `dev-blocklist.json` | `core-patches/02-paths-routing.mjs:4`; upstream `dev-blocklist.js:26` |
| `discord-signals.json` | upstream `discord-listener/index.js:27,54` and `cli.js:618` |

Audit covered `writeFile`, `appendFile`, `copyFile`, `rename`, and `mkdir`
sites in the installed tree, pack drop-ins, and routed upstream modules. Paper
trading persists through `state.json`; it has no separate data file. Installer
metadata/backups under `.zenpack` remain installer-owned and are removed.
Interactive upstream setup/credential utilities (`setup.js`, `envcrypt.js`) and
CLI skill installation are outside bot-runtime ownership; lockfile and
`node_modules` remain upstream/dependency-owned.

## Three-round formal matrix

| Round | Gate | Result | Evidence |
|---|---|---:|---|
| COLOK 1 | Fresh clone + exact checkout | ✅ | New clone at exact `5ab14b4`; initial porcelain empty. |
| COLOK 1 | `install.sh` only | ✅ | Installer ran `npm install --no-package-lock`, then copied 52 manifest files and completed every patch operation without a failed anchor. |
| COLOK 1 | Lockfile pristine | ✅ | SHA-256 remained `d89655d1441601f2bdf3067ac9555a0291fdf35e3d49b29f7a443641589aab1c`. |
| COLOK 1 | DRY_RUN boot | ✅ | `loaded 10 plugins (skipped 0, errors 0)`; bounded dummy-network run. |
| COLOK 1 | `/status` | ✅ | Hook handled and rendered output. |
| COLOK 1 | `/settings` + GMGN page | ✅ | Landing and `cfg:page:fn-gmgn` both rendered. |
| COLOK 1 | `/preset save` + `use` | ✅ | `formal82` saved and applied; probe restored its artifacts. |
| COLOK 1 | `/briefing` | ✅ | Paper fixture rendered briefing. |
| COLOK 1 | `/closeall` paper | ✅ | Paper position closed; network/TX assertion was zero. |
| CABUT | `uninstall.sh` restore | ✅ | All 23 patched tracked files restored and hash-verified clean. |
| CABUT | Runtime preservation/report | ✅ | Final line: `left runtime data: user-config.json, state.json, decision-log.json, hivemind-cache.json, logs/`. |
| CABUT | Formal porcelain policy | ✅ | Raw porcelain was empty in this run; policy checker also accepted it. Any non-whitelist residue now exits nonzero. |
| CABUT | Dependency ownership | ✅ | `node_modules` remained; uninstall did not remove it. |
| CABUT | Lockfile pristine | ✅ | Hash stayed identical to fresh clone. |
| CABUT | Vanilla tracked tree | ✅ | `git diff --exit-code 5ab14b4 --` and tracked modified/deleted/other gate were empty. |
| CABUT | Vanilla DRY_RUN boot | ✅ | Vanilla reached normal startup, DRY RUN, and cron startup. |
| CABUT | Vanilla `/settings` | ✅ | Mocked Telegram update produced actual `Settings menu` output before the bounded probe ended. |
| COLOK 2 | Reinstall/idempotence | ✅ | Existing dependencies were reused; 52 manifest files and all patches restored. |
| COLOK 2 | DRY_RUN boot | ✅ | Again `loaded 10 plugins (skipped 0, errors 0)`. |
| COLOK 2 | Same feature sample | ✅ | Status, settings/GMGN, preset save/use, briefing, and paper closeall all passed again; ZERO-TX. |
| FINAL | Pack harness | ✅ | `npm test`: hooks 8/8, patcher 17/17, loader, 26-entry runtime gate, syntax/inventory; `SMOKE v0.2: PASS`. |

## Integrity confirmations

- Golden reference was read-only. Before/after SHA-256 hashes were identical:
  `config.txt` `963a5326…3f54d`, `positions.txt` `a556d871…e62b0`,
  `settings.txt` `97c6c8f8…20192`, `status.txt` `5dfdcef2…39822`.
- Raw-diff gate passed: target `git diff --check` and pack `git diff --check`
  were clean; pack porcelain before/after the external cycle was byte-identical.
- Every install/runtime write stayed inside external disposable `fresh-81`;
  no test write landed in the pack, fork, or golden-reference directory.
- The target lockfile was never changed. The known upstream issue remains:
  literal `npm ci` cannot resolve `utf-8-validate@5.0.10` from the vanilla
  lockfile, so installer dependency ownership continues to use `npm install
  --no-package-lock`.
- Dummy wallet/key/token only. No live bot, PM2, live wallet, or transaction.

Stage 8.2 is closed. Stage 8.3 release work may proceed.
