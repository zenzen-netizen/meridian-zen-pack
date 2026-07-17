// Patch 20a: tools/dlmm.js dual-side E1 deploy path.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip20", n), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:20a-dlmm-dual-side",
  replaces: [
    {
      old: 'import { normalizeMint, getWalletBalances } from "./wallet.js";',
      new: 'import { normalizeMint, getWalletBalances, swapToken } from "./wallet.js";',
    },
    { old: snip("20a-1-OLD.txt"), new: snip("20a-1-NEW.txt") },
    { old: snip("20a-2-OLD.txt"), new: snip("20a-2-NEW.txt") },
    { old: snip("20a-3-OLD.txt"), new: snip("20a-3-NEW.txt") },
    { old: snip("20a-4-OLD.txt"), new: snip("20a-4-NEW.txt") },
    { old: snip("20a-5-OLD.txt"), new: snip("20a-5-NEW.txt") },
    { old: snip("20a-6-OLD.txt"), new: snip("20a-6-NEW.txt") },
    { old: snip("20a-7-OLD.txt"), new: snip("20a-7-NEW.txt") },
  ],
}];
