// Patch 20f: tools/pnl.js display-name helpers + dlmm import wiring.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip20", n), "utf8").replace(/\n$/, "");

export default [
  {
    file: "tools/pnl.js",
    marker: "zen-pack:20f-pnl-display-helpers",
    replaces: [{ old: snip("20f-pnl-OLD.txt"), new: snip("20f-pnl-NEW.txt") }],
  },
  {
    file: "tools/dlmm.js",
    marker: "zen-pack:20f-dlmm-pnl-import",
    replaces: [{
      old: 'import { computePositions, fetchDlmmPnlForPool } from "./pnl.js";',
      new: 'import { computePositions, fetchDlmmPnlForPool, resolveDisplayPair, firstResolvedName } from "./pnl.js";',
    }],
  },
];
