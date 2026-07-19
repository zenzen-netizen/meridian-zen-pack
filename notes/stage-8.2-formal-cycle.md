# Stage 8.2 — formal plug/unplug/plug cycle

Date: 2026-07-19 (Asia/Shanghai)

Pack: `b7a8d10096a4fd1ee34ba7cd417c8e37f593604c`
Vanilla: `5ab14b476e4e8d25c58f989c77b161721e1a505f`
Target: `/home/ubuntu/meridian-lab/fresh-81`

## Verdict

**❌ 8.2 NOT CLOSED; 8.3 release is blocked.** Both installed rounds and the
vanilla runtime sample passed, but uninstall left the untracked runtime file
`candidate-memory.json`. The required post-uninstall porcelain was therefore
not zero. No cleanup, ignore rule, or uninstall change was made in this
verification-only phase.

The previous disposable `fresh-81` was moved to Trash and a new vanilla clone
was checked out at exact SHA `5ab14b4` before the formal round.

## Three-round matrix

| Round | Gate | Result | Evidence |
|---|---|---:|---|
| COLOK 1 | `install.sh` only | ✅ | Dependency install owned by installer; lockfile unchanged; patch finished without failed anchors. |
| COLOK 1 | DRY_RUN boot | ✅ | `loaded 10 plugins (skipped 0, errors 0)`. Dummy OpenRouter 401 is the documented fixture baseline. |
| COLOK 1 | `/status` | ✅ | Hook handled and rendered output. |
| COLOK 1 | `/settings` | ✅ | Hook handled and rendered settings landing. |
| COLOK 1 | GMGN settings page | ✅ | `cfg:page:fn-gmgn` handled and rendered GMGN output. |
| COLOK 1 | `/preset save formal82` + `use` | ✅ | Both handled; fixture artifacts restored/removed by the probe. |
| COLOK 1 | `/briefing` | ✅ | Dummy paper briefing rendered. |
| COLOK 1 | `/closeall` paper | ✅ | Paper position closed through fixture; ZERO-TX assertion passed. |
| CABUT | `uninstall.sh` restore | ✅ | Every tracked file matched `5ab14b4`; `.zenpack` and installed plugin/drop-in files were removed. |
| CABUT | Preserve dependencies | ✅ | `node_modules` remained present. |
| CABUT | Lockfile pristine | ✅ | SHA-256 stayed `d89655d1441601f2bdf3067ac9555a0291fdf35e3d49b29f7a443641589aab1c`. |
| CABUT | Porcelain zero | ❌ | `?? candidate-memory.json` remained after uninstall. |
| CABUT | Vanilla DRY_RUN boot | ✅ | Vanilla emitted normal startup and cron logs; termination was bounded by timeout. |
| CABUT | Vanilla `/settings` alive | ✅ | Injected dummy Telegram update produced actual `Settings menu` output. |
| COLOK 2 | Reinstall/idempotence | ✅ | Existing `node_modules` skipped npm; 51 manifest entries and exactly 10 plugins restored with no failed patch. |
| COLOK 2 | DRY_RUN boot | ✅ | `loaded 10 plugins (skipped 0, errors 0)`. |
| COLOK 2 | Same feature samples | ✅ | Status, settings, GMGN page, preset save/use, briefing, and paper closeall all passed again; ZERO-TX. |

## Blocking residue

`candidate-memory.json` was born during the first installed DRY_RUN boot at
`2026-07-19T06:53:58Z`, when the screening cycle recorded candidate snapshots.
It is not in `.zenpack/install-manifest.txt`, so uninstall correctly did not
treat it as a copied pack file, but this violates the formal requirement that
porcelain be zero except for ignored `node_modules` and a pristine lockfile.

The tracked-tree hash gate itself passed: after uninstall, `git diff
5ab14b4 --` was empty. The sole CABUT failure was the untracked runtime residue.

## Integrity confirmations

- Golden reference was read-only. Before/after SHA-256 values were identical:
  - `config.txt`: `963a5326c465bf58785bd9442916d53ef86f6e620c49168a65298ba7a5e3f54d`
  - `positions.txt`: `a556d8719c36fae8b6b184f3e2c22f89270e43c79394eef9bd97e51a56be62b0`
  - `settings.txt`: `97c6c8f800dbd1d0c5785b64499a5189e89db942db037a559c5812ab30e20192`
  - `status.txt`: `5dfdcef2c3de96c2b4cae935ab6e85b65c04058edda0c22c673f7710d1739822`
- Pack was clean before this note; no code/build file was changed.
- Fork porcelain was byte-identical before/after.
- All install/runtime writes stayed under the external disposable target.
- Final raw diff shows the expected 23 patched tracked files, pack drop-ins,
  `.zenpack`, and the measured `candidate-memory.json` residue; lockfile has no diff.
- Dummy wallet/keys only. No PM2, live bot, or transaction was run.

## Next decision required

8.2 needs an explicit ownership decision for `candidate-memory.json` before a
release gate can pass: retain/ignore runtime state, or make uninstall remove it.
This report does not choose or implement either policy.
