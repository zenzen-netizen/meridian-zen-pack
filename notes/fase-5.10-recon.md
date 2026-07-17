# Fase 5.10 Recon — telegram.js

Target: `/home/ubuntu/meridian-lab/vanilla-test`.
Fork-ref: `/home/ubuntu/meridian-lab/fork-ref`.

## Anchor telegram.js

- `vanilla-test/telegram.js` installed line count: 523. Base vanilla line count: 519. Delta is patch 02 path routing only.
- `sendMessage`: line 151, count 1; still slices 4096.
- `sendHTML`: line 164, count 1; still slices 4096.
- `splitText`: absent, count 0.
- `flushFinal`: absent, count 0.
- `toolLabel`: line 225, count 1.
- `summarizeToolResult`: line 249, count 1.
- label anchors already present: `check_smart_wallets_on_pool` count 1, `get_active_bin` count 1.
- notify anchors count 1 each: `notifyDeploy` line 468, `notifyClose` line 490, `notifySwap` line 499, `notifyOutOfRange` line 508.
- forbidden import check: `from "./reports.js"` count 0.

## Patch 03b / plugin 10 interaction

- Patch runner order is lexical: `03b-telegram-hook.mjs` before future `18-telegram-ext.mjs`.
- Patch 03b file target is `index.js`, not `telegram.js`.
- Installed hook is `vanilla-test/index.js:1431-1435`, before `/briefing` at line 1436.
- Verdict: no overlap with telegram.js hunk 5.10. Continue.

## Path routing

- `telegram.js` already has patch 02 routing:
  - `import { paths } from "./paths.js"` at line 5.
  - `const USER_CONFIG_PATH = paths.userConfigPath;` at line 9.
- Verdict: skip block 1 paths in patch 18.

## Views deps

- `views/notifs.js` imports only `./format.js`.
- `views/format.js` has no imports.
- `node --check` passes for both, and isolate import passes for both.
- Verdict: self-contained enough for telegram.js render wrappers.

## reports.js trap

- `reports.js` landed and imports:
  `getHourlyProfile, classifySession, getNarrativeProfile, classifyNarrative, sessionLabel` from `./lessons.js`.
- Current lessons exports `getHourlyProfile` and `getNarrativeProfile` from patch 04a, but does not export `classifyNarrative`, `classifySession`, or `sessionLabel`.
- Isolate import fails: `does not provide an export named 'classifyNarrative'`.
- Verdict: do not import `reports.js` from `telegram.js`; set `gasSol = null` at notifyClose with deferred comment.
