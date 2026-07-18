// Patch 30: briefing persistence + boot/cron/management/REPL orchestration.
// Every replacement is exact-match and keeps vanilla fallbacks on uninstall.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip30", name), "utf8").replace(/\n$/, "");

export default [
  { file: "config.js", marker: "zen-pack:30-config-persist", replaces: [
    { old: snip("config-OLD.txt"), new: snip("config-NEW.txt") },
  ]},
  { file: "state.js", marker: "zen-pack:30-briefing-state", replaces: [
    { old: snip("state-OLD.txt"), new: snip("state-NEW.txt") },
  ]},
  { file: "index.js", marker: "zen-pack:30-briefing-wiring", replaces: [
    { old: snip("briefing-OLD.txt"), new: snip("briefing-NEW.txt") },
    { old: snip("management-OLD.txt"), new: snip("management-NEW.txt") },
    { old: snip("cron-OLD.txt"), new: snip("cron-NEW.txt") },
    {
      old: "  _cronTasks = [mgmtTask, screenTask, healthTask, briefingTask, briefingWatchdog];",
      new: "  _cronTasks = [mgmtTask, screenTask, healthTask, briefingTask, briefingWatchdog, weeklyTask, monthlyTask];",
    },
    { old: snip("repl-OLD.txt"), new: snip("repl-NEW.txt") },
  ]},
];
