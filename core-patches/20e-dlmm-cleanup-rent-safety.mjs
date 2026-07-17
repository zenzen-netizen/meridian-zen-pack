// Patch 20e: tools/dlmm.js non-atomic cleanup + logging/rent/I safety.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip20", n), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:20e-dlmm-cleanup-rent-safety",
  replaces: [
    {
      old: "  syncOpenPositions,\n} from \"../state.js\";",
      new: "  syncOpenPositions,\n  setPositionInstruction,\n} from \"../state.js\";",
    },
    { old: snip("20e-created-OLD.txt"), new: snip("20e-created-NEW.txt") },
    { old: snip("20e-mark-created-OLD.txt"), new: snip("20e-mark-created-NEW.txt") },
    { old: snip("20e-cleanup-OLD.txt"), new: snip("20e-cleanup-NEW.txt") },
    { old: snip("20e-signal-fields-OLD.txt"), new: snip("20e-signal-fields-NEW.txt") },
    { old: snip("20e-retry-OLD.txt"), new: snip("20e-retry-NEW.txt") },
    { old: snip("20e-pnl-sanity-OLD.txt"), new: snip("20e-pnl-sanity-NEW.txt") },
    { old: snip("20e-rent-OLD.txt"), new: snip("20e-rent-NEW.txt") },
    { old: snip("20e-final-close-OLD.txt"), new: snip("20e-final-close-NEW.txt") },
  ],
}];
