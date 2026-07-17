// Patch 22: kategori H/F9-light close result parity, fork experimental@643e954.
// Dua return besar RAW di snip22; assignment lesson dibuat exact dan unik per indent.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip22", name), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:22-dlmm-close-notif",
  replaces: [
    { old: "        await recordPerformance({", new: "        const derivedLesson1 = await recordPerformance({" },
    { old: snip("relay-OLD.txt"), new: snip("relay-NEW.txt") },
    { old: "      await recordPerformance({", new: "      const derivedLesson2 = await recordPerformance({" },
    { old: snip("local-OLD.txt"), new: snip("local-NEW.txt") },
  ],
}];
