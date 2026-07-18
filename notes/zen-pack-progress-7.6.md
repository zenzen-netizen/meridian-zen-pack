# Stage 7.6 - commands money / agentLoop blocks 3-6

## 7.6-A recon checkpoint - STOP

Recon only. No build patch, plugin, sizing change, or test was written.

Sources:

- fork `643e954` from `/home/ubuntu/meridian-lab/vanilla`
- vanilla `5ab14b4`
- installed sandbox `/home/ubuntu/meridian-lab/vanilla-test`
- pack worktree was clean before this note

### 1. `agent.js` full-diff accounting

The complete `5ab14b4..643e954 -- agent.js` diff has 22 hunks. Every hunk is
accounted for; there is no unknown residual outside the existing patch 10,
existing patch 11, and planned patch 29.

| Fork hunk / line | Owner |
|---|---|
| L8 SCREENER tool trim | patch 10 |
| L16-L21 `CHAT_CONFIRM_TOOLS` | patch 29 block 4 |
| L65-L81 bilingual intent patterns | patch 10 |
| L107 `recordLlmCost` import | patch 29 block 5 |
| L117-L126 fallback client | patch 11 block 1 |
| L129-L132 bilingual intent regexes | patch 10 |
| L142-L180 content-tool parser and sets | patch 11 block 2a |
| L223 options destructure | patch 29 blocks 4/6 |
| L252-L256 recovery counters | patch 11 block 2c |
| L271-L275 fallback routing | patch 11 block 1b |
| L287 general max tokens | patch 29 block 6 |
| L288 usage request | patch 29 block 5 |
| L291 active client call | patch 11 block 1c |
| L292-L296 cost recording | patch 29 block 5 |
| L323-L328 fallback failover | patch 11 block 1d |
| L345-L363 argument repair rewrite | patch 29 block 3 prerequisite |
| L366-L384 content salvage | patch 11 block 2b |
| L394-L416 reject text dump | patch 11 block 2d plus patch 29 block 6 ternary |
| L417-L421 `allowNoToolFinal` guard | patch 29 block 6 |
| L445-L495 `runToolCall` refactor | patch 29 block 3, includes block 4 gate |
| L497-L511 dedup cache/fan-out | patch 29 block 3 |

The argument-repair changes are not a separate feature. Fork block 3 removes
`invalidToolArgErrors`, clears unrecoverable args to `{}`, and moves the tool
result shape into `runToolCall`. Porting dedup without that upstream rewrite
would leave a dead map and would not be verbatim fork.

The new option-controlled paths remain vanilla when callers omit options:
`onConfirmRequired=null` and `allowNoToolFinal=false`. The brief's broader test
statement that all blocks 3-6 are dormant without a caller is not achievable
with a verbatim fork port: block 5 always adds `usage:{include:true}` and records
cost, while block 6 changes GENERAL from vanilla `maxTokens` default 4096 to
the already-injected fork `generalMaxTokens` default 8192. Cost recording is
fail-open, but neither delta is byte/behavior parity. Owner must narrow the
parity assertion to option-controlled paths or explicitly authorize gating;
gating/tuning would no longer be the requested verbatim extraction.

### 2. Patch 11 / patch 29 anchor conflict

Apply order is lexical: patch 11 runs before patch 29. Most planned patch 29
anchors are unique and do not cross the actual patch 11 EOF marker. The large
block-3 replacement is wholly inside `agentLoop`; the appended block-2a marker
at EOF is untouched.

There is one hard reinstall conflict. Patch 11 replacement 2d installs the full
current `snip11/2d-reject.txt`. Patch 29 must then restore the fork ternary at
L404-L406 and change the L421 guard to include `!allowNoToolFinal`. On a second
install, patch 11 no longer finds either its vanilla OLD line or its complete
old NEW snippet, so `replaceLine` returns `old-not-found` before patch 29 runs.
This violates the required reinstall-idempotent gate.

STOP verdict: build cannot start until owner chooses the migration mechanism.
Recommended minimal mechanism: add optional `already` support to `replaceLine`
and pass it through `apply.mjs`, then let patch 11 recognize a unique post-29
fork line as already installed. Alternative: restructure patch 11's 2d snippet
with migration-aware alternative anchors. Do not merely ignore `old-not-found`.

### 3. `sessionHistory` decision

Fork Telegram fallback passes index-local `sessionHistory` and calls local
`appendHistory` (fork L2980-L2987, L3484-L3490). A plugin cannot access either.

Recommendation: option (a), plugin-owned history, capped verbatim at 20
messages. Once plugin 70 handles non-command Telegram text, the vanilla
Telegram fallback is dead, so Telegram still has one history. Risk: TTY/REPL
keeps a separate core history and conversations do not cross surfaces. Option
(b) preserves cross-surface history but creates a new mutable core export/API
and does not solve the separate candidate-cache and busy-state dependencies.

Owner decision required before 7.6-D.

### 4. Hook order and hidden busy dependency

Patch 28 currently invokes `telegram:command` for every non-slash text before
vanilla callback handling and before the `_managementBusy/_screeningBusy/busy`
queue guard. Plugin 60 registers before a prospective plugin 70, so the observed
pipeline is:

1. plugin 60 consumes `_pendingInput` when present;
2. plugin 70 can consume intent-routing fallback;
3. `ctx.handled` returns before vanilla fallback.

This proves the requested coverage, but exposes a hidden dependency: handling
plain fallback in the early pass bypasses vanilla's busy queue and allows
overlapping agent loops. Conversely, `confirm:` callbacks must run in the early
pass while the first loop is busy, or confirmation deadlocks behind that queue.

Recommended minimal wiring: tag patch-28 context as early. Plugin 70 handles
`confirm:` callbacks in the early phase, but defers ordinary non-slash text to
the existing patch-03b pass after the vanilla busy/queue guard. Intent routing
then still wins before vanilla fallback. Owner approval is required because
this extends the existing hook contract.

### 5. Exact command boundaries

- `/closeall` is exactly fork L3327-L3351. It contains only close-all behavior.
- `/set <n> <note>` is L3353-L3365 and is out of scope.
- `/setcfg` is L3367-L3387 and is out of scope.
- `/screen` is L3389-L3396.
- `/candidates` plus `/deploy <n>` reply is L3398-L3424.

The brief's broad `:3327-3388` range includes `/set` and `/setcfg`; neither may
be swept into 7.6 close-all.

### 6. Hidden candidate-cache dependency

`/candidates`, `/deploy <n>`, and `deployLatestCandidate` use index-local
`_latestCandidates`. That cache is populated only by `runDeterministicScreen`
and the `/screen` branch at fork L3389-L3396. Plugin code cannot see the core
cache. Porting only the listed L3398-L3424 branch would always have an empty
plugin cache or would read a different cache from vanilla `/screen`.

Owner decision required: expand plugin 70 to own `/screen`, candidate cache,
`/candidates`, and `/deploy` as one dead-path replacement; or export the core
cache/helpers. The plugin-owned cluster is recommended because it avoids a new
mutable core API. This is a required dependency, not an automatic defer.

### 7. Sizing mechanism and consumers

Fork definitions verified at `config.js` L498-L558:

- `minDeployAmount()` keeps the literal `0.03` floor.
- `computeDeployAmount(walletSol, opts={})` uses maximize mode, descending
  adaptive slot count, per-position rent reserve, floor-to-3-decimals, and
  returns zero when even one slot cannot clear the minimum.
- fixed mode is the vanilla formula and remains slot-blind.

Verdict: extend `zenpack-lib/sizing.js`; do not modify vanilla
`config.js::computeDeployAmount`. Plugin-owned `deployLatestCandidate` imports
the extension directly, matching plugin-50's live config mutation precedent.

Fork has additional cycle consumers in `index.js` L702/L766 plus display/REPL
consumers at L3167/L3206/L3687 and `tools/dlmm.js` L726. They remain core vanilla
consumers unless separately wired. Record as 7.8/7.9 debt; do not port them in
7.6. Existing executor floor already imports `minDeployAmount` from the sizing
extension.

### 8. Dependency sweep

Available drop-ins/exports: `llm-cost-tracker.js`, `agentLoop`, Telegram send /
edit / callback functions, `views/cycle.js` confirm constants and builders,
`views/format.js`, wallet/DLMM/screening/token/smart-wallet functions, executor,
decision log, and config-extension keys. No live bot or live transaction path
was touched.

Open owner decisions before build:

1. patch-11/post-29 reinstall migration mechanism;
2. plugin-owned history vs exported core history;
3. early/normal hook phase handling for queue-safe fallback plus live callbacks;
4. scope expansion for plugin-owned `/screen` and candidate cache.
5. resolution of the impossible all-blocks-dormant default-parity assertion.
