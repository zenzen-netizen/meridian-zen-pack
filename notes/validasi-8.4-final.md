# Validasi 8.4 Final

Tanggal penutupan: 2026-07-23.

## Backlog Terkait

- `logger.js:49`: deploy action hint reads `amount_sol`, while current callers
  may pass `amount_y`; cosmetic `undefined SOL` output only. Support both fields
  later.
- PM2 ecosystem runbook: ecosystem config filenames must match `*.config.cjs`,
  and copied config files must not retain opening/closing Markdown code fences.
- `presets/receh_84.json`: temporary 8.4 validation uses
  `positionSizePct: 0.12`; original `mainzen_v2_1` value is `0.5`.

## Keputusan Deviasi

- Deviasi #1: **OFF-via-config**. Vanilla key `opportunityPollEnabled` is
  defined in `config-schema.js:147`, mapped by `tools/executor.js:498`, and read
  by `config.js:219`. Owner verdict: dicoba live, kualitas lemah.
- Deviasi #2: **dorman**. `degenScore` remains in code for normal screening
  conviction but no longer drives the disabled opportunity poller.
- Deviasi #4: **provisioned and fail-closed tested**. No remote URL, seed data,
  JSON, or cache was found in the old `/home/ubuntu/meridianzen` or
  `/home/ubuntu/meridianzen2` trees; only the same `dev-blocklist.js` module
  existed. `dev-blocklist.json` is therefore provisioned as valid `{}`.
  Protection is operational but empty; populating deployer wallets is an owner
  decision.

## Evidence

- `update_config` action at `2026-07-23T14:06:51.494Z` persisted
  `opportunityPollEnabled=false`; live startup at `14:07:11Z` and `14:39:07Z`
  logged management `10m`, screening `30m`, and no opportunity timer.
- Zero `[Opportunity]` events occurred after the disabled config was loaded.
  Normal management and screening cycles continued.
- Controlled corruption produced `[DEV_BLOCKLIST_ERROR]` at `14:30:03Z` and
  `14:34:46Z`. Both cycles stopped before any action/deploy row was appended.
- The valid `{}` file was restored. The recovery cycle at `14:39:08Z` passed
  blocklist loading and reached candidate discovery (`Multi-category merge`).
  It later stopped on the separately recorded external model HTTP 500.
- Final state: PM2 online, valid blocklist object present, poller disabled.

## Final Verdict

| # | Butir | Vonis final | Catatan |
|---|---|---|---|
| 1 | Opportunity poller | **OFF** | OFF-via-config; live trial quality weak |
| 2 | Degen Score | **DORMAN** | Code retained; no poller trigger |
| 3 | Uptime/live operation | **LULUS** | Controlled restarts only; process online |
| 4 | Dev blocklist | **LULUS** | Valid empty file; fail-closed visible and deploy held |
| 5 | GMGN config | **LULUS** | Valid JSON; `jq empty` succeeds |
| 6 | External anomalies | **TERCATAT** | Telegram/Jupiter/Helius/model noise; model 500 also seen on recovery |
| 7 | Receh/PnL ledger | **LULUS** | 50 successful 0.030 SOL positions reconciled; net recorded -$0.9492 exact |

## Penutupan Preset

- `mainzen_v2_1` restored via `applyPreset`, followed by `update_config` for
  the owner-approved `deployAmountSol=0.03` floor and retained
  `opportunityPollEnabled=false` decision.
- Final live and persisted sizing: `activeSetup=mainzen_v2_1`,
  `sizingMode=maximize`, `positionSizePct=0.5`, `deployAmountSol=0.03`.
- Live screening at `2026-07-23T14:48:00.573Z` computed a `0.153 SOL` deploy
  from a `0.240065 SOL` wallet. **Warning:** subsequent deploys have returned
  to full maximize sizing (roughly `0.15-0.2 SOL` at this balance range), by
  design; `0.03 SOL` is only the minimum floor.
- `presets/receh_84.json` remains the validation-racikan archive.

## 8.6 Fork Archive

- `/home/ubuntu/meridianzen` branch `legacy-monolith` points exactly to
  `643e954f03305c039291a57f27fe477d4ff5e320` and is pushed to
  `zenzen-netizen/zenmerimerizen`.
- Active branch remains `experimental`.
- Existing dirty files `package-lock.json`, `package.json`, `paper-trading.js`,
  and `tools/dlmm.js` were not committed or modified; before/after hashes
  matched.

## §5 Definition of Done — v1.0.0 FINAL

- [x] Vanilla base and pack release identity are pinned and documented.
- [x] Pack installation, runtime-data migration, and live operation are
      validated.
- [x] Validation 8.4 receh ledger, deviations, blocklist safety, and external
      noise are closed with final verdicts.
- [x] Production preset is restored with full-sizing warning recorded;
      `receh_84` remains archived.
- [x] Legacy monolith is frozen on a remote archive branch without committing
      its dirty working tree.
- [x] Final project evidence is stored in the pack repository.

**Project status: v1.0.0 FINAL.**
