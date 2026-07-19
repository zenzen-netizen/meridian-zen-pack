# PRA-8 Recon — executor block 1 `update_config`

Status: **CHECKPOINT APPROVED; IMPLEMENTATION CLOSED**. Final result and gates
are recorded in `notes/pre-8-update-config-closure.md`. Source of truth remains
`git show 643e954`; the fork worktree is not used because it has local changes.

## 1. Full handler map

The installed handler is vanilla `main@5ab14b4` plus Patch 27. The fork handler
changes the complete mutation contract, not only its whitelist:

- signature `{changes, reason}` becomes `args`, accepting `changes`, flat
  `key/value`, dotted `path/value`, section-nested objects, and bare top-level
  keys;
- string coercion covers booleans, `off`/`null`, numbers, and selected
  comma-separated arrays;
- per-key schema validation replaces vanilla `normalizeConfigValue`, collects
  invalid entries, and keeps valid entries in the same call;
- scalar no-op detection avoids repeat writes, cron restarts, and lessons;
- nested runtime fields and legacy persistence paths are supported;
- sensitive `gmgnApiKey`, `hiveMindApiKey`, and `publicApiKey` values are
  redacted from logs, results, and lesson summaries;
- GMGN keys write to `gmgn-config.json`; other keys write to
  `user-config.json`; mixed calls may write both;
- interval changes restart cron and non-ephemeral changes add one lesson.

The fork map has 168 keys. The installed map has 137. Fork adds 44 GMGN keys
beyond the two GMGN keys already present in vanilla. A verbatim replacement
would drop these 13 live vanilla-only keys:

`autoSwapRetryAttempts`, `autoSwapRetryDelayMs`, `pnlConfirmTicks`,
`loneCandidateMinDegen`, `opportunityPollEnabled`,
`opportunityPollIntervalSec`, `opportunityPollLimit`, `opportunityMinScore`,
`opportunitySmartWalletBonus`, `degenTargetVolRatio`, `degenTargetLpCount`,
`degenTargetFeeRatio`, and `degenTargetLiquidity`.

This is incompatible with locked baseline delta #1/#2: the vanilla opportunity
poller and its Degen Score consumer remain active. Recommendation: port the fork
handler body but merge these 13 keys, producing 181 executable keys. Add schema
entries for all 13 instead of relying on the fork schema's fail-open behavior.

## 2. Patch 27 disposition

Patch 27 adds 35 non-GMGN fork keys to the vanilla map. All 35 already exist in
the fork handler, so keeping Patch 27 before a full handler replacement creates
a redundant intermediate mutation and an unnecessary marker-dependent anchor.

Recommendation: retire Patch 27 from the patch runner and manifest; replace it
with one registered PRA-8 patch that owns the complete merged handler and flat
definition. Patch count can remain stable by replacing ownership rather than
stacking a second whitelist patch.

## 3. Paths and boot-time GMGN dependency

The old debt text says executor paths Batch-2 is absent. Current Patch 02 already
routes:

- `config.js` to `paths.userConfigPath` and `paths.gmgnConfigPath`;
- `tools/executor.js` to `paths.userConfigPath`;
- profiles through `MERIDIAN_DATA_DIR`.

PRA-8 therefore only needs `const GMGN_CONFIG_PATH = paths.gmgnConfigPath` in
executor. No second paths abstraction or patch is needed.

Hidden dependency: after Stage 7 made `tools/gmgn.js` fork-complete, Plugin 50
still deliberately injects no GMGN superset. Vanilla `config.js` loads only five
GMGN fields, while the fork GMGN producer reads many more at call-time. Merely
porting executor persistence would make edits work until restart, then lose most
values from live `config.gmgn`.

Recommendation: the same workstream must extend Plugin 50 to load the complete
fork GMGN defaults/values from `paths.gmgnConfigPath` at boot and config reload.
This closes the consumer side without copying the full fork `config.js` into a
new core patch.

## 4. Definition/schema mismatches

The existing `config-schema.js` drop-in is byte-identical to fork `643e954` and
has 168 entries, matching the fork map. It lacks the 13 retained vanilla keys.

The fork definition also advertises three names that its own handler and schema
do not accept:

| Definition advertises | Executable canonical key |
|---|---|
| `gmgnRequireBullishSupertrend` | `gmgnRequireBullishSt` |
| `gmgnRejectAlreadyAtBottom` | `gmgnRejectAtBottom` |
| `gmgnRequireAboveSupertrend` | `gmgnRequireAboveSt` |

Recommendation: make the flat definition advertise the executable canonical
names used by Plugin 60. Do not add speculative aliases. Golden must record this
three-name correction plus the 13 locked vanilla keys as intentional deltas.

## 5. Existing live data (read-only, values never printed)

PM2 metadata identifies MAIN and bot3 online; v3 is stopped. JSON key-only audit:

| Instance | `user-config.json` legacy GMGN keys | `gmgn-config.json` |
|---|---|---|
| MAIN | none | exists; canonical `minTokenAgeHours` plus tune metadata |
| bot3 | `gmgnFeeSource` | absent |
| v3 | none | absent |

Thus live data already spans both formats. MAIN must keep its split value; bot3
needs legacy `gmgnFeeSource` moved to canonical `feeSource` when that bot is
migrated; v3 currently needs no GMGN move.

## 6. One-shot migration and backup plan

Run per active `paths.dataDir` on first packed boot, never globally during pack
installation. Before any write:

1. Parse both files completely; unreadable JSON stops migration without changing
   either file.
2. Detect legacy top-level `gmgn*` keys in `user-config.json` using the canonical
   handler mapping.
3. Back up exact source bytes beside each affected file with a stable PRA-8
   migration suffix; never overwrite an existing backup.
4. Canonical `gmgn-config.json` values win conflicts, matching fork load
   precedence. Copy only missing canonical values, including nested
   `indicatorRules`, then remove migrated legacy keys from user config.
5. Write temporary files and rename them; write GMGN first. A crash between
   writes leaves safe duplication, and rerun completes idempotently.
6. Log only migrated key names/counts, never values. With no legacy keys, do
   nothing and create no backup.

Migration belongs in Plugin 50 because it already owns profile-aware config
injection and runs once per PM2 profile. The actual live files remain untouched
until each bot's Stage 8.4/8.5 migration.

Safety deviation recommended: unlike fork line 670, an unreadable existing
`gmgn-config.json` must be fail-closed. The fork silently replaces it with `{}`
on the next GMGN edit, which can erase the racikan.

## 7. Plugin 60 recovery

After executor persistence, boot loading, and migration pass their tests:

- delete `GMGN_GATE_TEXT`, `isGmgnKey`, `gateGmgnCallback`, and both early-return
  gate branches;
- route GMGN button, toggle, step, and pending input through the same
  `executeTool("update_config")` path as non-GMGN settings;
- replace the old “does not mutate” test with split-persistence tests proving
  GMGN values never land in `user-config.json`.

## 8. Proposed build/gates after owner approval

### B — runtime/persistence

- replace Patch 27 with the merged 181-key handler + flat definition;
- add 13 schema entries and complete Plugin 50 GMGN load/reload;
- add profile-aware, backed-up, atomic, idempotent migration;
- make corrupt existing GMGN JSON fail closed.

### C — menu recovery

- remove Plugin 60 gate only after B passes;
- prove callback and pending-input GMGN writes use only `gmgn-config.json`.

### D — money gate and closure

- handler tests: all accepted argument shapes, arrays, case-insensitivity,
  nested fields, mixed split writes, partial-invalid visibility, no-op, cron,
  redaction, and corrupt-file fail-closed behavior;
- migration tests: absent/existing files, conflicts, exact backups, nested rules,
  profile routing, interrupted safe state, and second-run byte idempotence;
- paper harness with explicit `ZERO-TX:0` through `executeTool`;
- golden fork handler/definition after only the declared 13-key, three-name, and
  fail-closed adaptations;
- fresh install, reinstall, uninstall, reinstall, and migration cycle;
- all suites + smoke + DRY_RUN boot; explicit golden and raw ownership audit;
- separate commits/pushes for B, C, and D. No live bot or restart before 8.4.

## 9. Owner checkpoint

Recommended lock as one indivisible package:

1. preserve the 13 vanilla-only keys and validate them;
2. supersede/remove Patch 27 rather than stack it;
3. close the hidden Plugin 50 GMGN boot/reload dependency now;
4. correct the three definition names to executable canonical names;
5. use the backed-up profile-aware migration plan;
6. deviate from fork only to fail closed on corrupt existing GMGN JSON;
7. remove Plugin 60's gate after the full path is proven.

STOP after this recon until owner approval.
