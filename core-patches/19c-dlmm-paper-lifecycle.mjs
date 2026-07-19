// Patch 19c: tools/dlmm.js paper lifecycle helpers + position listing (A3).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const block = readFileSync(join(here, "snip19", "a3.txt"), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:19c-dlmm-paper-lifecycle",
  replaces: [{
    old: "// ─── Get My Positions ──────────────────────────────────────────\nexport async function getMyPositions({ force = false, silent = false, wallet_address = null } = {}) {",
    new: block,
    // Patch 33 extends the paper-close return inside this whole-block replacement.
    // Treat that final migrated shape as installed on subsequent upgrades.
    already: "    peak_pnl_pct: tracked.peak_pnl_pct ?? null, // pack-side paper/live shape fidelity",
  }],
}];
