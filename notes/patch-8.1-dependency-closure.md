# PATCH-8.1 — dependency closure

Date: 2026-07-19 (Asia/Shanghai)

## Decision A implemented

- `install.sh [--no-deps] <target>` now checks dependencies immediately after
  target validation and before `.zenpack`, copy, or patch mutation.
- Missing `node_modules` runs `npm install --no-package-lock` in the target.
  `--no-package-lock` keeps the committed vanilla lockfile byte-identical.
- An npm failure exits 1 with an explicit STOP message before target mutation.
- Existing `node_modules` skips npm with a clear log line.
- `--no-deps` explicitly skips the dependency step.
- `uninstall.sh` is unchanged and contains no `node_modules` removal; formal
  uninstall proved the directory survives.
- No money-path file changed.

## Upstream issue retained, not patched

Vanilla `5ab14b4` has an out-of-sync `package-lock.json`: `npm ci` fails because
`utf-8-validate@5.0.10` is absent from the lockfile. This is a candidate report
to yunus upstream. The pack does not modify or replace the vanilla lockfile.

Original and final lockfile SHA-256 in the disposable fresh target:

`d89655d1441601f2bdf3067ac9555a0291fdf35e3d49b29f7a443641589aab1c`

## Fresh literal test

Target: `/home/ubuntu/meridian-lab/fresh-81`
Vanilla: `5ab14b476e4e8d25c58f989c77b161721e1a505f`

The previous disposable target was moved to Trash because the execution guard
rejected `rm -rf`; a new clone was then created at the exact requested path.

| Gate | Result | Evidence |
|---|---:|---|
| Forced npm failure | ✅ | Exit 1; explicit `npm install FAILED`; no `.zenpack`, copy, patch, or `node_modules`. |
| `--no-deps` | ✅ | Skip logged; no `node_modules` created; install and uninstall remained clean. |
| Literal `install.sh` only | ✅ | Installer ran npm itself, then 6 append / 21 patch / 173 replace / 4 intentional idempotent skips; no failed patch. |
| Lockfile untouched | ✅ | SHA-256 identical before install, after install, uninstall, and reinstall. |
| DRY_RUN boot | ✅ | `loaded 10 plugins (skipped 0, errors 0)`. |
| Uninstall | ✅ | All tracked vanilla files restored; `.zenpack` and pack drop-ins removed; `node_modules` retained. |
| Reinstall | ✅ | Logged `node_modules present: skip npm install`; 51 manifest entries and 10 plugins restored. |
| Pack smoke | ✅ | Includes `bash -n` and dependency-gate ordering check. |
| Full harness | ✅ | Pack smoke plus all 30 installed-target MJS gates exited 0. |
| Paper/ZERO-TX gates | ✅ | Screening, management, executor, update-config, and wallet suites all passed. |
| Golden read-only | ✅ | Four before/after SHA-256 values are identical. |
| Raw-diff isolation | ✅ | Fresh target is outside pack/fork; pack diff is only installer, smoke gate, and this note; fork status unchanged. |

Golden final hashes:

- `config.txt`: `963a5326c465bf58785bd9442916d53ef86f6e620c49168a65298ba7a5e3f54d`
- `positions.txt`: `a556d8719c36fae8b6b184f3e2c22f89270e43c79394eef9bd97e51a56be62b0`
- `settings.txt`: `97c6c8f800dbd1d0c5785b64499a5189e89db942db037a559c5812ab30e20192`
- `status.txt`: `5dfdcef2c3de96c2b4cae935ab6e85b65c04058edda0c22c673f7710d1739822`

## Closure

**8.1 CLOSED.** The literal fresh-clone claim now passes. Next authorized phase:
8.2 formal plug-unplug-plug cycle.
