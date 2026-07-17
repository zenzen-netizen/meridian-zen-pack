// Patch 25a: W1 suspect/quarantine + W2 evolve tiap 5 close LIVE-only.
// recordPerformance utuh disimpan RAW karena blok fork memuat template literal.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip25a", name), "utf8").replace(/\n$/, "");

export default [{
  file: "lessons.js",
  marker: "zen-pack:25a-lessons-record-live",
  replaces: [
    {
      old: "// <<< zen-pack:02-paths-routing <<<\n\n",
      new: "// <<< zen-pack:02-paths-routing <<<\nimport { ICON, SEP, tree, header } from \"./views/format.js\"; // primitif string-only (no dep) — Batch I FINAL S2\n\n",
    },
    { old: snip("record-OLD.txt"), new: snip("record-NEW.txt") },
  ],
}];
