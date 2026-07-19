# PRA-8 closure — executor block 1 `update_config`

Status: **COMPLETE IN SANDBOX; LIVE MIGRATION NOT RUN**. The locked base remains
vanilla `main@5ab14b4`, and fork truth remains `git show 643e954`.

## Locked result

- Patch 27 is **superseded in place**. Its legacy 35-key additive operation is
  retained only as an upgrade bootstrap; the patch then replaces the complete
  old handler with the full PRA-8 handler. Pristine vanilla and an installation
  already carrying old Patch 27 converge on the same bytes through `already`.
- The handler exposes 181 validated keys: all 168 fork keys plus the 13 vanilla
  opportunity/Degen/PnL/auto-swap keys required by baseline deviations #1/#2.
- Non-GMGN changes persist to `user-config.json`; GMGN changes persist to
  `gmgn-config.json`. Mixed calls write both canonical files, valid values in a
  partially invalid request remain applied, and `invalid[]` stays visible.
- Sensitive values are redacted from results, logs, and lessons. Scalar no-ops
  do not rewrite bytes. Existing corrupt GMGN JSON fails closed before runtime
  mutation or persistence.
- Plugin 50 owns the complete GMGN boot/reload surface plus profile-local
  migration. Plugin 60's temporary GMGN gate was removed only after those paths
  passed; GMGN menu writes now use the same `executeTool("update_config")` path.

## Migration contract

Migration runs only when Plugin 50 boots for one `paths.dataDir`; pack install
does not scan or mutate live profiles. It parses both JSON files before writes,
creates stable `.pre-zenpack-pra8.bak` exact-byte backups without overwriting an
existing backup, gives canonical split data precedence, writes GMGN first by
temporary-file rename, removes only mapped legacy keys, and is byte-idempotent.

`gmgnFeeSource` maps to canonical `feeSource`. Unknown `gmgn*` keys are preserved
in `user-config.json` and reported by name, never silently deleted or logged with
their values.

The seven migration fixtures cover the three observed live shapes:

- MAIN: existing split GMGN data wins and stays byte-identical;
- bot3: legacy `gmgnFeeSource` migrates to `feeSource` with exact backup;
- stopped v3: no GMGN data produces no write or backup;
- plus mixed conflict/nested rules, unknown preservation, corrupt fail-closed,
  and second-run byte idempotence.

Real MAIN/bot3/v3 files were not changed. Their migrations remain Stage 8.4/8.5.

## Conscious fixes and source evidence

### Four GMGN arrays

This is a latent fork bug found during PRA-8, not a pack regression. Fork
executor `643e954:tools/executor.js:520-522` splits only the pre-existing array
keys. Fork schema `643e954:config-schema.js:273-276` accepts either arrays or raw
strings, while the restart loader `643e954:config.js:101-104` accepts only arrays.
The old Plugin 60 exposes comma-list inputs at its lines 305 and 307 but its
pending parser at lines 637-645 accepts only numbers/off. That combination can
write a schema-valid string which disappears back to defaults after restart.

The conscious correction is narrowly bounded:

- `core-patches/snip27/update-config-NEW.txt:236-240` includes
  `gmgnFilters`, `gmgnPlatforms`, `gmgnPreferredKolNames`, and
  `gmgnDumpKolNames` in `ARRAY_KEYS`;
- `plugins/config-schema.js:170-171,187,189` keeps all four typed as arrays;
- `zenpack-plugins/50-config-ext.js:93-94,118-119` loads only arrays;
- `zenpack-plugins/60-settings-menu.js:58,303,305,624-625` parses comma lists
  only for preferred/dump KOL pending input; numeric GMGN inputs are unchanged.

The functional test writes `gmgnPlatforms`, verifies persisted JSON bytes, calls
config reload, then boots a fresh Node process and verifies the same array.

### Three dead definition names

Fork handler execution uses `gmgnRequireBullishSt`, `gmgnRejectAtBottom`, and
`gmgnRequireAboveSt` at `643e954:tools/executor.js:461-463`; fork schema accepts
those same names at `643e954:config-schema.js:183-185`. The longer names exposed
only by the fork definition were dead. The definition now advertises the three
executable names and adds no aliases. This is a recorded conscious correction,
not verbatim drift.

## Deviation-aware safety

**Deviation #5:** existing corrupt `gmgn-config.json` is fail-closed. Fork line
670 swallows parse errors and can subsequently replace the file from `{}`. The
pack returns a visible failure before mutating runtime config or either file.

Stage 8.4 must test this on the smallest live-receh bot: induce a controlled
GMGN read/parse failure, prove the operator sees it, prove no config bytes are
overwritten, and prove deployment is held rather than continuing with defaults.
Do not call deviation #5 safe before that evidence. This joins the already
mandatory live checks for opportunity poller, Degen Score, vanilla two-tick exit,
and dev-blocklist fail-closed behavior.

## Golden and gates

- Golden installed bytes equal the committed handler/definition NEW snippets.
  Normalizing against fork `643e954` leaves only these measured exceptions:
  marker 1; retained baseline keys 13; normalized GMGN arrays 4; fail-closed
  block 1; corrected definition names 3.
- All 33 `tests/*.test.mjs` pass. Key results: migration 7/7, update_config
  11/11 with `ZERO-TX:0`, settings menu 5/5, config boot/reload 16/16, and Stage
  7.10 money gate 8/8 with ZERO-TX.
- `npm test` smoke passes. DRY_RUN dummy boot loads 10 plugins, 0 skipped,
  0 errors, and shuts down with 0 open positions; timeout 124 is intentional.
- Raw ownership is clean: backups 23/23 equal vanilla HEAD, drop-ins 51/51 equal
  pack sources, and pack/target `git diff --check` pass.
- Lifecycle passes: uninstall restores exact `5ab14b4` with empty porcelain;
  vanilla settings/commands fallback 1/1 each; fresh install succeeds; immediate
  reinstall skips every operation.
- Legacy upgrade passes: install pack `2fd82fb` (old additive Patch 27), install
  current pack, verify golden and update_config 11/11, reinstall skips all ops,
  then uninstall restores exact vanilla with empty porcelain.

No live bot, PM2 process, live config, or real transaction was touched.
