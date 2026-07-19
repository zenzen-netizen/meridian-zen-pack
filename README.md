# Meridian Zen Pack

Reproducible overlay for Yunus Meridian commit `5ab14b4`. A clean clone at
that commit plus this pack's installer produces the complete Zen bot. Removing
the pack restores the exact vanilla tracked tree while preserving runtime data.

> **Financial risk:** this software can control real funds when DRY_RUN is off.
> It is not financial advice. Use dummy credentials for testing. The installer
> never restarts a bot or PM2 process; restart is always an explicit owner action.

## Install and uninstall

```bash
TARGET="$PWD/meridian-yunus-5ab14b4"
git clone https://github.com/yunus-0x/meridian "$TARGET"
git -C "$TARGET" checkout --detach 5ab14b4

git clone https://github.com/zenzen-netizen/meridian-zen-pack
cd meridian-zen-pack
./install.sh "$TARGET"
```

The default installer runs `npm install --no-package-lock` when the target has
no `node_modules`, then applies every registered patch and drop-in. It stops
before patching if dependency installation fails. Use `--no-deps` only when
dependencies are already managed separately:

```bash
./install.sh --no-deps "$TARGET"
```

Vanilla commit `5ab14b4` has an upstream lockfile issue: `npm ci` fails because
`utf-8-validate@5.0.10` is absent from `package-lock.json`. The installer does
not modify that lockfile.

To remove the overlay:

```bash
./uninstall.sh "$TARGET"
```

Uninstall restores all tracked files byte-for-byte to vanilla and removes only
pack-owned files. It preserves and reports all existing runtime data.

## Runtime-data ownership

`manifest.json.runtime_data` is the source of truth: 26 whitelisted paths cover
configs, presets, state, lessons, candidate/pool/decision memory, histories,
cost/gas logs, exports, profiles, and migration artifacts. Uninstall never
deletes them and ends with `left runtime data: ...`. Porcelain outside this
whitelist fails the uninstall gate. `node_modules` and the pristine upstream
lockfile remain upstream-owned.

Writer evidence for every entry is recorded in
[the Stage 8.2 closure](notes/patch-8.2-runtime-data-closure.md).

## Upgrading the Yunus basis

Do **not** pull or merge upstream inside an installed target. Treat each tested
upstream commit as a release boundary:

1. Clone Yunus into a new disposable directory and checkout the proposed SHA.
2. Replay `install.sh` there. Anchor drift is reported by the installer at each
   patch operation; any missing or non-unique anchor stops qualification.
3. Re-run the fresh-clone, feature, uninstall/reinstall, golden, and raw-diff
   gates.
4. Only after they pass, update `tested_upstream_sha`, create a new release, and
   tag it with the new upstream SHA.
5. Migrate live instances through a separate owner-approved rollout; never by
   pulling into the installed target.

## Release inventory

- 46 registered anchor patches
- 10 hook plugins (`10 loaded / 0 skipped / 0 errors` in the release gate)
- 52 owned drop-ins: 6 library, 18 root, 12 views, 1 tool, 4 scripts, 1 guide,
  and 10 plugin files
- Tested upstream: `5ab14b476e4e8d25c58f989c77b161721e1a505f`

Authoritative verification:

- [Stage 7.10 inventory and delta ledger](notes/zen-pack-progress-7.10.md)
- [Stage 8.1 fresh-clone feature checklist](notes/brief-8.1-fresh-clone-report.md)
- [Stage 8.1 dependency closure](notes/patch-8.1-dependency-closure.md)
- [Stage 8.2 formal cycle and runtime policy](notes/patch-8.2-runtime-data-closure.md)

## Conscious deviations

| ID | Retained delta | Release status |
|---|---|---|
| #1 | Vanilla opportunity poller remains active although the fork removed it. | Validate on the first owner-approved live rollout. |
| #2 | `degenScore` remains because that poller consumes it. | Keep with #1 unless the poller is retired. |
| #3 | Vanilla two-tick exit confirmation remains; the fork's 15-second/emergency engine is not ported. | Paper behavior and vanilla parity are locked. |
| #4 | Vanilla `dev-blocklist.js` remains fail-closed instead of fork fail-open. | Live failure visibility is mandatory before declaring it safe. |
| #5 | Corrupt existing `gmgn-config.json` fails closed instead of silently becoming `{}`. | Live visibility, no-overwrite, and deployment hold require owner validation. |
| Baseline | DLMM transport fallbacks remain; LLM cost recording is always on and GENERAL defaults to 8192 tokens. | Accepted upstream/safety transport delta. |

Exact contracts and golden exceptions remain in the authoritative notes above.
