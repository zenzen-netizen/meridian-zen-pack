// Patch 21: lessons.js lapisan BACA fork experimental@643e954.
// OLD/NEW besar disimpan RAW di snip21 agar template literal/backtick verbatim.
// Patch 03a/04a lebih dulu memasang subset lama; operasi ketiga mengganti tail
// gabungan itu dengan read-layer fork lengkap tanpa menyentuh write-layer 6.5.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip21", name), "utf8").replace(/\n$/, "");

export default [{
  file: "lessons.js",
  marker: "zen-pack:21-lessons-read-layer",
  replaces: [
    { old: snip("signals-OLD.txt"), new: snip("signals-NEW.txt") },
    { old: snip("list-OLD.txt"), new: snip("list-NEW.txt") },
    { old: snip("read-OLD.txt"), new: snip("read-NEW.txt") },
  ],
}];
