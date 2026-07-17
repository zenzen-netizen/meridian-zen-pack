// Patch 25c: W5 dedup, W6 removeLesson, W7 live prompt filter, W8 sim marker.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip25c", name), "utf8").replace(/\n$/, "");

export default [{
  file: "lessons.js",
  marker: "zen-pack:25c-lessons-writers-prompt",
  replaces: [
    { old: snip("add-OLD.txt"), new: snip("add-NEW.txt") },
    {
      old: "}\n\n/**\n * Remove lessons matching a keyword in their rule text (case-insensitive).\n */\nexport function removeLessonsByKeyword(keyword) {",
      new: "}\n\n/**\n * Remove a lesson by ID.\n */\nexport function removeLesson(id) {\n  const data = load();\n  const before = data.lessons.length;\n  data.lessons = data.lessons.filter((l) => l.id !== id);\n  save(data);\n  return before - data.lessons.length;\n}\n\n/**\n * Remove lessons matching a keyword in their rule text (case-insensitive).\n */\nexport function removeLessonsByKeyword(keyword) {",
    },
    {
      old: "  const data = load();\n  if (data.lessons.length === 0) return null;",
      new: "  const data = load();\n  // Sim (paper) lessons: shown while dry-running (it's the whole dataset), but\n  // EXCLUDED from the live prompt unless opted in via usePaperHistoryWhenLive.\n  // When the opt-in is on they're kept but flagged 🧪 in fmt() so the model treats\n  // them as low-credibility soft reference — never as live, mechanical truth.\n  if (!isPaperMode() && !config.experiments?.usePaperHistoryWhenLive) {\n    data.lessons = data.lessons.filter((l) => !l.paper);\n  }\n  // Suspect (unverified ≤−90%) lessons never enter the prompt, in either mode — a\n  // bad-data artifact must not steer the agent until the operator verifies it.\n  data.lessons = data.lessons.filter((l) => !l.suspect);\n  if (data.lessons.length === 0) return null;",
    },
    { old: snip("fmt-OLD.txt"), new: snip("fmt-NEW.txt") },
  ],
}];
