// Stage 6.6: full-file briefing.js replacement, byte-exact experimental@643e954.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip26", name), "utf8").replace(/\n$/, "");

export default [{
  file: "briefing.js",
  marker: "zen-pack:26b-briefing-full-parity",
  replaces: [{ old: snip("briefing-OLD.txt"), new: snip("briefing-NEW.txt") }],
}];
