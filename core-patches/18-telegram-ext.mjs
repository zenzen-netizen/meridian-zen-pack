// Patch 18: telegram.js display/notif parity.
//
// Patch 23 finalizes the reports import/gas payload; keeping that final NEW here
// preserves Patch 18 idempotency on reinstall while Patch 23 migrates old installs.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = "zen-pack:18-telegram-ext";
const snip = (n) => readFileSync(join(here, "snip18", n), "utf8").replace(/\n$/, "");

export default [
  {
    file: "telegram.js",
    marker: M,
    replaces: [
      { old: snip("imports-OLD.txt"), new: snip("imports-NEW.txt") },
      { old: snip("send-OLD.txt"), new: snip("send-NEW.txt") },
      { old: snip("summarize-OLD.txt"), new: snip("summarize-NEW.txt") },
      { old: snip("flushfinal-OLD.txt"), new: snip("flushfinal-NEW.txt") },
      { old: snip("live-icons-OLD.txt"), new: snip("live-icons-NEW.txt") },
      { old: snip("finalize-OLD.txt"), new: snip("finalize-NEW.txt") },
      { old: snip("dispatch-OLD.txt"), new: snip("dispatch-NEW.txt") },
      { old: snip("callback-await-OLD.txt"), new: snip("callback-await-NEW.txt") },
      { old: snip("message-await-OLD.txt"), new: snip("message-await-NEW.txt") },
      { old: snip("commands-OLD.txt"), new: snip("commands-NEW.txt") },
      { old: snip("notify-OLD.txt"), new: snip("notify-NEW.txt") },
    ],
  },
];
