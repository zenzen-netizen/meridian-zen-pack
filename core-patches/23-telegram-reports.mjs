// Patch 23: telegram close gas + reports consumers, fork experimental@643e954.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip23", name), "utf8").replace(/\n$/, "");

export default [{
  file: "telegram.js",
  marker: "zen-pack:23-telegram-reports",
  replaces: [
    {
      old: 'import { ICON } from "./views/format.js";',
      new: 'import { ICON } from "./views/format.js";\nimport { estimateGasSol } from "./reports.js";',
    },
    { old: snip("notify-OLD.txt"), new: snip("notify-NEW.txt") },
  ],
}];
