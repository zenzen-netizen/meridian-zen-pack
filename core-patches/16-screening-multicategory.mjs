// Patch 16: tools/screening.js — multi-category discovery + yield proxy.
//
// Owner-locked deviation: keep degenScore intact even though fork removes it.
// Opportunity poller in vanilla-test/index.js still imports/calls degenScore.
// No screening:afterFetch hook exists in fork, so no hook infra is created.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = "zen-pack:16-screening-multicategory";
const snip = (n) => readFileSync(join(here, "snip16", n), "utf8");

const SCORE_OLD = `export function scoreCandidate(pool) {
  const feeTvl = Number(pool.fee_active_tvl_ratio || 0);
  const organic = Number(pool.organic_score || 0);
  const volume = Number(pool.volume_window || 0);
  const holders = Number(pool.holders || 0);
  return feeTvl * 1000 + organic * 10 + volume / 100 + holders / 100;
}`;

const SINGLE_CATEGORY_OLD = `  const data = await fetchPoolDiscoveryPage({
    page_size,
    filters,
    timeframe: s.timeframe,
    category: s.category,
  });

  let rawPools = Array.isArray(data.data) ? data.data : [];`;

export default [
  {
    file: "tools/screening.js",
    marker: M,
    replaces: [
      { old: SCORE_OLD, new: snip("score-yield.txt") },
      { old: SINGLE_CATEGORY_OLD, new: snip("multicategory.txt") },
      { old: "    total: data.total,", new: "    total: rawPools.length," },
    ],
  },
];
