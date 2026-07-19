# Stage 7.8 — cron screening cycle, throttle, and funnel

## 7.8-A — recon checkpoint (STOP before build)

Recon only. No screening plugin, core patch, test, sandbox mutation, or money
path was added in this phase.

Sources checked directly from Git objects:

- fork `643e954:index.js`
- vanilla `5ab14b4:index.js`
- installed sandbox `/home/ubuntu/meridian-lab/vanilla-test`
- pack worktree `/home/ubuntu/meridian-zen-pack`

The brief's fork numbers are confirmed as the locked scope description:
`runScreeningCycle` fork L665-L1165 versus vanilla L360-L679, described as 25
logical hunks and `+248/-62`. The zero-context Git diff splits some adjacent
logical changes more finely; the table below deliberately groups them into the
requested 25 behavior hunks rather than pretending those raw fragments are
separate features.

### 1. Full 25-hunk accounting

Legend: `P` = plugin-owned candidate, `C` = core patch/lifecycle owner. “Ready”
means the installed sandbox exports the dependency now; it does not mean the
whole upstream producer is live.

| # | Fork lines | Exact delta / role | Category | Dependency and installed status | Proposed owner |
|---:|---|---|---|---|---|
| 1 | 681 | max-position skip uses `cycleSkip(...)` | display | `views/cycle.js::cycleSkip` ready/exported | P |
| 2 | 691-717 | broke guard uses `slotsRemaining`, sizing-v2, literal min floor, gas + per-position rent, and `cycleSkip` | guard/deploy | `zenpack-lib/sizing.js::{computeDeployAmount,minDeployAmount}` ready; config keys ready | P; pays 7.6 debt consumer fork L702 |
| 3 | 719-748 | opt-in SOL 24h market-regime gate; threshold default `8`; fail-open | guard/signal | `tools/wallet.js::getSolMarketRegime` ready; experiment config ready | P |
| 4 | 751 | pre-check failure uses `cycleFail(...)` | display/guard | `cycleFail` ready | P |
| 5 | 756 | live title uses `CYCLE_TITLE.screen` | display | `CYCLE_TITLE` ready | P |
| 6 | 763-767 | deploy sizing uses open slots and logs slots/mode | deploy | sizing-v2 ready | P; pays 7.6 debt consumer fork L766 |
| 7 | 771-776 | strategy block honors `strategyLock`; default remains flexible | deploy/guard | config extension and executor enforcement ready | P |
| 8 | 779-783 | candidate fetch preserves error text and returns `cycleFail` instead of swallowing to null | guard/display | `getTopCandidates` ready, but GMGN producer gap below | P |
| 9 | 786-796 | always-on, fail-open candidate snapshot recording | signal | all `candidate-memory.js` snapshot exports ready | P |
| 10 | 798-800 | retain `stage_counts` and `all_filtered` for funnel | signal/display | consumer fields supported; installed `getTopCandidates` does **not** produce them | P, blocked by GMGN prerequisite |
| 11 | 821-844 | GMGN candidates bypass duplicate Jupiter launchpad/bot filters | guard | `pool.gmgn` only exists from missing GMGN discovery pipeline | P, blocked by GMGN prerequisite |
| 12 | 846-871 | zero-candidate report: five examples, funnel from stage 2, verbatim threshold list, `buildNoCandidates` | display/guard | view builder ready; funnel helper local/not exported | P |
| 13 | 874-877 | sparse (`<=1`) GMGN funnel goes to screening log | display | `log` ready; funnel producer missing | P |
| 14 | 879-895 | lone-candidate reject uses fork helper + funnel + `buildLoneNoDeploy` | guard/display | builder ready; Plugin 70 has fork logic; core still has vanilla degen variant | P plus one shared-helper decision |
| 15 | 897-908 | always-on, fail-open smart-wallet count recording | signal | candidate-memory record export ready | P |
| 16 | 925-934 | opt-in candidate momentum prompt line | signal | getter/formatter and config ready | P |
| 17 | 936-950 | opt-in expected yield-to-me proxy using deploy, SOL price, TVL, fee/TVL | signal | `tools/screening.js::formatYieldToMe` ready/exported | P |
| 18 | 952-960 | opt-in smart-wallet momentum prompt line | signal | getter/formatter and config ready | P |
| 19 | 962-998 | source-specific candidate rendering: rich GMGN formatter; Meteora adds GMGN price-action line; all three soft signals included | signal/display | `formatGmgnCandidateForPrompt` **absent**; fork producer absent | P, blocked by GMGN prerequisite |
| 20 | 1013-1022 | Darwin staging adds top10, bot, age, mint/freeze, and dev-migration entry fields | signal | `stageSignals` ready and accepts additive fields | P |
| 21 | 1040 | prompt states preloaded recon is final and forbids six redundant tool calls | deploy/guard | agent tool surface ready | P |
| 22 | 1042-1049 | decision/pick wording, single-candidate conviction, fixed configured strategy, exact bin formula, SOL-only amounts | deploy/guard | config ready; no threshold tuning permitted | P |
| 23 | 1100-1104 | `agentLoop` option `allowNoToolFinal: true` | guard | Patch 29 installed; exact option supported | P |
| 24 | 1116-1130 | replace fake `DEPLOYED` and raw JSON/tool dump with honest `NO DEPLOY` | guard/display | `stripThink` is core-local; plugin can own verbatim helper | P |
| 25 | 1131-1162 | append funnel; decisions use sanitized `reportContent`; errors use `cycleFail`; final title uses `CYCLE_TITLE`; leaked live-message fallback and Telegram queue drain | display/guard | builders/title ready; `drainTelegramQueue` and busy lifecycle are index-local | P body + C lifecycle bridge |

No fork floor or threshold was normalized or tuned in this accounting. The
prompt arithmetic remains verbatim, including
`round(min + (volatility/5)*(max-min))` and all config-driven limits.

### 2. Structural verdict

**Recommendation: one whole-cycle plugin override at a core choke point, with
the vanilla function body left in place as the dead-body uninstall/failure
fallback. Do not apply 25 per-hunk replacements.**

Rationale:

- the decision path is one cohesive transaction-like orchestration: guards,
  snapshotting, recon, prompt, deploy observation, anti-hallucination, display,
  and cleanup share locals;
- 25 raw anchors would cross existing Patch 30's management adjacency and make
  reinstall/upstream drift harder to audit;
- a single hook anchor plus the cron throttle anchor is materially smaller and
  matches the successful `runBriefing` choke-point pattern from 7.7;
- the untouched vanilla body remains a real fallback and uninstall restores the
  original behavior without reconstructing a 500-line function.

The hook cannot be a naive call at function entry. Core locals must remain the
coordination authority:

1. core checks/sets `_screeningBusy` synchronously and updates
   `_screeningLastTriggered` before awaiting the plugin;
2. plugin runs the fork decision body;
3. a narrow context callback marks `timers.screeningLastRun` at the exact fork
   point after prechecks, not on a skipped guard;
4. core clears `_screeningBusy` and drains the Telegram queue in `finally` even
   when the plugin throws;
5. when no handler is installed, core releases its wrapper lock and immediately
   enters the unchanged vanilla fallback.

Risk: the golden comparison needs explicit structural exclusions for the core
lock/timer/queue bridge. All 25 decision hunks can still compare verbatim. A
handler error must **not** fall through into vanilla after a possible deploy;
that would risk a second deploy. It must return a failed cycle report and release
the lock. “Fallback” is for handler absent/uninstalled, not post-side-effect
retry.

Per-hunk patching is rejected as the default because its only advantage is
byte-locality; it costs roughly 25 migration-aware anchors and still cannot solve
the missing GMGN producer or cache ownership.

### 3. Hidden local state and Plugin 70 cache

#### Screening lifecycle locals

- `_screeningBusy`: shared exclusion used by scheduled screening, management,
  opportunity poller, PnL poller, and Telegram queue draining. A plugin-private
  busy flag would be incorrect.
- `_screeningLastTriggered`: management cooldown and the vanilla opportunity
  poller's five-minute cooldown both read it. It must stay core-owned.
- `timers.screeningLastRun`: prompt countdown and adaptive scheduled throttle
  read it. Fork writes it only after hard guards pass.
- `liveMessage` and `screenReport`: cycle-local; safe for the override to own.
- `drainTelegramQueue`: index-local; cleanup must be bridged by the core wrapper.
- no `state.js` screening subset is added here. Trough/peak/deployed-at remain
  explicitly 7.9.

#### Candidate caches — current split is real

Core index owns `_latestCandidates/_latestCandidatesAt`. It is populated by TTY
startup, TTY `/candidates`, and vanilla interactive screening paths. Plugin 70
owns a second array/timestamp populated by its Telegram `/screen`, then read by
its `/candidates` and `/deploy`. `runScreeningCycle` itself populates neither
cache in both vanilla and fork.

Therefore a Stage-7.8 cycle plugin must not create a third cache or silently
publish scheduled candidates into one surface only. The current two-cache split
can already diverge between TTY and Telegram.

Recommended owner decision: create one shared candidate-cache facade and migrate
both core interactive consumers and Plugin 70 to it. This is wider than the 25
cycle hunks but is the only honest “one cache” result. Alternatives are:

1. retire Plugin 70's `/screen`/`/candidates`/`/deploy` cluster back to core after
   porting all fork sizing/render behavior there; or
2. explicitly accept TTY and Telegram as isolated caches (not recommended and
   contrary to the no-two-cache warning).

Plugin 70 already contains the fork lone-candidate rule and sizing-v2 deploy
logic. Core still contains vanilla's `degenScore >= loneCandidateMinDegen` solo
rule. Leaving both against separate caches would produce different deploy
decisions for the same pool.

### 4. Helper diffs

- `buildGmgnFunnelReport`, fork L1530-L1546, is new and has no module dependency.
  Keep it plugin-owned beside the cycle; exporting it from core would create an
  API solely for the plugin.
- `getLoneCandidateSkipReason`, fork L1548-L1570 versus vanilla L1681-L1713,
  replaces vanilla degen conviction with smart-wallet count (including GMGN),
  adds wash/rug/PVP guards, retains exact fee/top10/bot floors, and requires
  narrative or smart-wallet confirmation. Plugin 70 already implements this
  fork behavior; core does not. One shared implementation is required alongside
  the cache decision.
- `computeBinsBelow`, fork L1572-L1580 and vanilla L1715-L1723, is byte-identical;
  the full-file diff only moves it. No behavioral patch is justified. Reuse one
  implementation; do not manufacture a change for line parity.
- owner-locked `degenScore` remains exported from `tools/screening.js` and used
  by the preserved vanilla opportunity poller. Fork's removal is intentionally
  not followed.

### 5. Cron, management, CLI, and opportunity wiring

Callers verified:

| Caller | Current behavior | Stage-7.8 wiring |
|---|---|---|
| scheduled `screenTask` | direct `runScreeningCycle` every configured base interval | patch only this call-site with `shouldRunScheduledScreening`; adaptive weak-session ticks skip |
| post-management freed slot | direct `runScreeningCycle()` under cooldown | bypass throttle exactly as fork comment requires |
| opportunity poller | direct `runScreeningCycle({silent:true})` after degen/smart-wallet pre-gate | preserve unchanged; it reaches the same override and bypasses scheduled throttle |
| `cli.js` | imports exported `runScreeningCycle` | reaches the same override |
| Telegram `/screen` | Plugin 70 deterministic cache refresh, not the deploy cycle | cache-owner decision above; do not conflate with cron cycle |

Throttle details are fork-verbatim:

- `effectiveScreeningIntervalMin`, L1175-L1180: base is at least 1; adaptive OFF
  returns base; adaptive ON uses the ceiling only when
  `classifySession(currentWibSession().key) === "weak"`.
- `shouldRunScheduledScreening`, L1188-L1196: OFF always runs; weak session uses
  elapsed time since `timers.screeningLastRun` with the exact `eff - 0.5` margin.
- cron wrapper, L1259-L1265: logs WIB session label/effective minutes, then awaits
  the cycle.
- `lessons.js::{classifySession,currentWibSession}` are installed exports.
- management cadence, PnL cadence, opportunity interval, and event-driven
  screening are not throttled.

The opportunity poller is present in vanilla L767-L829/current installed core,
including `degenScore`; fork removed it. Per locked deviation #1 it must remain,
including `_opportunityPollInterval` shutdown cleanup and the exact call into
`runScreeningCycle({silent:true})`.

### 6. Hidden dependency blocker: GMGN screening producer is not installed

The consumer-side funnel is not independently live. Current installed state:

- config/UI expose `screening.source=gmgn` and the GMGN settings;
- installed `tools/screening.js::getTopCandidates` still always uses Meteora and
  never returns `source`, `stage_counts`, or `all_filtered` with stage metadata;
- installed `tools/gmgn.js` is the small vanilla token-fee client and does not
  export `discoverGmgnPools` or `formatGmgnCandidateForPrompt`;
- fork `tools/gmgn.js` is `+652/-11` versus vanilla (`663` changed lines total)
  and also depends on `fetchChartIndicatorsForMint` (that chart-indicator export
  is already installed/ready);
- fork `tools/screening.js` imports `discoverGmgnPools`, dispatches on
  `screening.source`, filters occupied/blocked GMGN pools, and returns funnel
  metadata. Patch 16 ported multi-category Meteora and yield formatting only;
  it intentionally retained `degenScore` for the opportunity poller and did not
  port this GMGN dispatch.

This is a STOP-level prerequisite, not an optional display nicety: selecting
GMGN currently leaves the setting asleep, while hunk 19 would import a missing
export. Build cannot claim “ON=hidup” or golden fork behavior without an owner
scope decision.

Recommended decision: authorize a bounded GMGN prerequisite extraction in
7.8-B before the cycle plugin, retaining the two locked deviations:

1. keep vanilla `degenScore` export and opportunity poller;
2. port only the fork GMGN discovery/formatting path and the exact
   `getTopCandidates` source dispatch needed by this cycle, with fixtures and no
   network/live transaction.

Alternative: declare GMGN source/funnel out of scope and gate all consumer
branches. That would not be a verbatim/full fork extraction and needs explicit
owner acceptance.

### 7. Gate plan after owner decision (not executed)

- one fixture test per regime, candidate momentum, yield, smart-wallet momentum,
  GMGN funnel, lone-candidate rule, sizing guard, fake-deploy guard, and malformed
  output guard;
- exact `allowNoToolFinal: true` assertion against installed Patch 29 agentLoop;
- cron fixtures proving adaptive OFF parity, weak-session throttle, base-session
  run, and management/opportunity bypass;
- two-layer paper gate: paper OFF behavior parity; paper ON deploy/close lifecycle
  alive; every fixture asserts `ZERO-TX` and stubs `agentLoop`/executor/network;
- golden comparison for all 25 fork hunks, throttle helpers/call-site, funnel,
  and lone helper, with only documented hook lifecycle adaptations excluded;
- full syntax, install/uninstall/reinstall+migration, harness, full tests,
  backup/raw-diff accounting, and explicit opportunity-poller/degen presence;
- no restart, no live bot, no live transaction.

### 8. Owner decisions required before 7.8-B

1. Approve the recommended whole-cycle plugin override plus one core lifecycle
   choke-point and dead vanilla fallback, instead of 25 per-hunk patches.
2. Approve the bounded hidden GMGN producer prerequisite, or explicitly accept a
   non-verbatim GMGN-disabled extraction.
3. Choose the candidate-cache resolution. Recommendation: one shared facade for
   core and Plugin 70; no third cache and no scheduled-cycle cache side effect.
4. Confirm the hook error rule: after the plugin starts, fail closed to a cycle
   error report and never fall through to vanilla/retry deploy.

STOP. Await owner decision; 7.8-B/C/D have not started.
