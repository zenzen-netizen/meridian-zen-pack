// Patch 19b: tools/dlmm.js paper PnL + close dispatch (A2/A4).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip19", n), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:19b-dlmm-paper-edges",
  replaces: [
    { old: snip("a2-OLD.txt"), new: snip("a2-NEW.txt") },
    { old: snip("a4-OLD.txt"), new: snip("a4-NEW.txt") },
  ],
}];
