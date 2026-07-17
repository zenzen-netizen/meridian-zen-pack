// Patch 20c: tools/dlmm.js relay circuit breaker.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip20", n), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:20c-dlmm-relay-circuit",
  replaces: [
    { old: snip("20c-circuit-OLD.txt"), new: snip("20c-circuit-NEW.txt") },
    { old: snip("20c-failure-OLD.txt"), new: snip("20c-failure-NEW.txt") },
  ],
}];
