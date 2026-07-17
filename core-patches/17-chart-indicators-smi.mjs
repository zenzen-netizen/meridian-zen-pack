// Patch 17: tools/chart-indicators.js — full fork parity for SMI preset wiring.
//
// Full-file replace by design: owner requested fork byte-exact chart-indicators.js.
// `fetchChartIndicatorsForMint` becomes an exported dead export until gmgn.js phase.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = "zen-pack:17-chart-indicators-smi";
const snip = (n) => readFileSync(join(here, "snip17", n), "utf8");

export default [
  {
    file: "tools/chart-indicators.js",
    marker: M,
    replaces: [
      {
        old: snip("chart-indicators-OLD.js"),
        new: snip("chart-indicators-NEW.js"),
      },
    ],
  },
];
