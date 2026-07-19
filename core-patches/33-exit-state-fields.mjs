// Stage 7.9-B: fork state metadata/excursions on the upstream vanilla 2-tick engine.
// Deliberately absent: queue/resolve 15s machinery, timer fields, emergency close,
// and _pollTriggeredAt. Paper peak return is a pack-side shape-fidelity adaptation.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip33", name), "utf8").replace(/\n$/, "");

const EXCURSION_OLD = `  let changed = false;\n\n  // Activate trailing TP once trigger threshold is reached`;
const EXCURSION_NEW = `  let changed = false;\n\n${snip("state-excursion-NEW.txt")}  // Activate trailing TP once trigger threshold is reached`;

export default [
  {
    file: "state.js",
    marker: "zen-pack:33-exit-state-fields",
    replaces: [
      {
        old: 'import { log } from "./logger.js";',
        new: 'import { log } from "./logger.js";\nimport { config } from "./config.js";',
      },
      { old: snip("state-record-OLD.txt"), new: snip("state-record-NEW.txt") },
      { old: EXCURSION_OLD, new: EXCURSION_NEW },
    ],
  },
  {
    file: "tools/dlmm.js",
    marker: "zen-pack:33-exit-state-fields",
    replaces: [
      {
        old: "  syncOpenPositions,\n  setPositionInstruction,",
        new: "  syncOpenPositions,\n  ensureDeployedAt,\n  setPositionInstruction,",
        already: "  ensureDeployedAt,\n  setPositionInstruction,",
      },
      {
        old: "      for (const positionAddress of (pool.listPositions || [])) {\n        const tracked = getTrackedPosition(positionAddress);",
        new: "      for (const positionAddress of (pool.listPositions || [])) {\n        // Persist deployed_at on first sight so age / minutes-held survives a\n        // state reset and is always available for untracked on-chain positions.\n        ensureDeployedAt(positionAddress, { pool: pool.poolAddress, pool_name: `${pool.tokenX}-${pool.tokenY}` });\n        const tracked = getTrackedPosition(positionAddress);",
        already: "        ensureDeployedAt(positionAddress, { pool: pool.poolAddress, pool_name: `${pool.tokenX}-${pool.tokenY}` });",
      },
      {
        old: "    base_mint: baseMint,\n    pnl_usd: pnlUsd,\n    pnl_pct: pnlPct,\n    fees_earned_usd: m?.fees_usd ?? 0,",
        new: "    base_mint: baseMint,\n    pnl_usd: pnlUsd,\n    pnl_pct: pnlPct,\n    peak_pnl_pct: tracked.peak_pnl_pct ?? null, // pack-side paper/live shape fidelity\n    fees_earned_usd: m?.fees_usd ?? 0,",
        already: "    peak_pnl_pct: tracked.peak_pnl_pct ?? null, // pack-side paper/live shape fidelity",
      },
    ],
  },
];
