// Stage 7.8-C: one screening choke point + fork-verbatim adaptive cron throttle.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip32", name), "utf8").replace(/\n$/, "");

export default [{
  file: "index.js",
  marker: "zen-pack:32-screening-cycle",
  replaces: [
    {
      old: 'import { evolveThresholds, getPerformanceSummary } from "./lessons.js";',
      new: 'import { evolveThresholds, getPerformanceSummary, classifySession, currentWibSession } from "./lessons.js";',
    },
    { old: snip("cycle-choke-OLD.txt"), new: snip("cycle-choke-NEW.txt") },
    {
      old: "export function startCronJobs() {",
      new: `${snip("throttle-NEW.txt")}export function startCronJobs() {`,
    },
    { old: snip("cron-screen-OLD.txt"), new: snip("cron-screen-NEW.txt") },
  ],
}];
