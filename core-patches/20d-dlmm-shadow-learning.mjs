// Patch 20d: tools/dlmm.js shadow signals + narrative learning fields.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip20", n), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:20d-dlmm-shadow-learning",
  replaces: [
    {
      old: 'import { trackTxGas } from "../gas-tracker.js";',
      new: 'import { trackTxGas } from "../gas-tracker.js";\nimport { getCandidateMomentum, getSmartWalletMomentum } from "../candidate-memory.js";',
    },
    { old: snip("20d-capture-OLD.txt"), new: snip("20d-capture-NEW.txt") },
    { old: snip("20d-relay-track-OLD.txt"), new: snip("20d-relay-track-NEW.txt") },
    { old: snip("20d-local-track-OLD.txt"), new: snip("20d-local-track-NEW.txt") },
    { old: snip("20d-relay-perf-OLD.txt"), new: snip("20d-relay-perf-NEW.txt") },
    { old: snip("20d-local-perf-OLD.txt"), new: snip("20d-local-perf-NEW.txt") },
  ],
}];
