# Fase 5.8 Recon

Target: `/home/ubuntu/meridian-lab/vanilla-test`  
Fork-ref: `/home/ubuntu/meridian-lab/fork-ref`

## Anchors

- `vanilla-test/tools/screening.js:35` exports `scoreCandidate`; fork makes it local and adds `gmgn_score` scoring.
- `vanilla-test/tools/screening.js:59` exports `degenScore`; MUST stay. Fork deletes it, but vanilla-test `index.js` still imports/calls it for opportunity poller.
- `vanilla-test/tools/screening.js:461` single-category `fetchPoolDiscoveryPage`; fork replaces with multi-category merge/dedupe/fail-open.
- `vanilla-test/tools/screening.js:584` returns `total: data.total`; fork returns `total: rawPools.length`.
- `fork-ref/tools/screening.js:46` has `formatYieldToMe`; consumer is `fork-ref/index.js:942`, not yet in vanilla-test. Additive export is safe, consumer deferred with index work.
- No `screening:afterFetch` / `afterFetch` hook exists in fork screening; skip hook creation.

## SMI Chain

- `vanilla-test/tools/smi.js` is present and byte-identical to fork (`166` lines).
- `vanilla-test/tools/chart-indicators.js` is `299` lines; fork is `366` lines with `evaluateSmi`, `supertrend_plus_smi`, exported `fetchChartIndicatorsForMint`, and `rejectAlreadyAtBottom` veto.
- Owner decision after STOP: patch 17 uses full-parity fork `chart-indicators.js`; exported `fetchChartIndicatorsForMint` is allowed as dead export until `gmgn.js` phase.
- `vanilla-test/index.js` already imports `confirmIndicatorPreset`.
- `vanilla-test/tools/gmgn.js` does not import `fetchChartIndicatorsForMint`; defer gmgn wiring to gmgn phase.

## Deviations

- DEVIASI-SADAR #2: preserve `degenScore` despite fork removal, because opportunity poller adopted in 5.1 still uses it.
- `gmgn.js import fetchChartIndicatorsForMint` deferred to gmgn phase.
