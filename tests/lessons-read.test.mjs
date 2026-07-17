// Gate 6.4 read-layer: fixture sintetis terisolasi, tanpa data/angka live.
import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) throw new Error("pakai: node tests/lessons-read.test.mjs <path-target>");
const dataDir = mkdtempSync(join(tmpdir(), "zp-lessons-read-"));
process.env.MERIDIAN_DATA_DIR = dataDir;
process.env.DRY_RUN = "false";

const lessons = await import(pathToFileURL(join(target, "lessons.js")).href);
const { config } = await import(pathToFileURL(join(target, "config.js")).href);
config.activeSetup = null;
config.experiments = { ...(config.experiments || {}), paperTrading: false };

const readExports = [
  "currentWibSession", "sessionLabel", "getAllPerformance", "getArchivedPerformance",
  "getLifetimePerformance", "getPerformanceForRacikan", "listRacikanInPerformance",
  "getModePerformance", "getSuspectCount", "getExcludedRacikanStats",
  "getPerformanceSummary", "getHourlyProfile", "classifySession",
  "getTimeProfileForPrompt", "getNarrativeProfile", "classifyNarrative",
  "getNarrativeProfileForPrompt",
];
assert.strictEqual(readExports.length, 17);
for (const name of readExports) assert.strictEqual(typeof lessons[name], "function", `${name} export`);

// Dataset kosong: seluruh pembaca fail-open dan shape stabil.
assert.deepStrictEqual(lessons.getAllPerformance(), []);
assert.deepStrictEqual(lessons.getModePerformance(), []);
assert.deepStrictEqual(lessons.getLifetimePerformance(), []);
assert.deepStrictEqual(lessons.getArchivedPerformance(), []);
assert.strictEqual(lessons.getPerformanceSummary(), null);
assert.strictEqual(lessons.getHourlyProfile().total_with_open_time, 0);
assert.strictEqual(lessons.getNarrativeProfile().total_with_category, 0);
assert.strictEqual(lessons.getTimeProfileForPrompt(), null);
assert.strictEqual(lessons.getNarrativeProfileForPrompt(), null);

// Field lama tanpa tag active_setup/open_session/narrative_category: tidak crash.
const lessonsPath = join(dataDir, "lessons.json");
writeFileSync(lessonsPath, JSON.stringify({ lessons: [], performance: [{
  pnl_usd: 2, pnl_pct: 4, initial_value_usd: 50, range_efficiency: 80,
  recorded_at: "2026-07-01T00:00:00.000Z",
}] }));
assert.strictEqual(lessons.getModePerformance().length, 1);
assert.strictEqual(lessons.getPerformanceSummary().roi_pct, 4);
assert.strictEqual(lessons.getHourlyProfile().total_with_open_time, 0);
assert.strictEqual(lessons.getNarrativeProfile().total_with_category, 0);

// Delapan sampel sintetis menghidupkan profile/prompt, plus listLessons(full).
const perf = Array.from({ length: 8 }, (_, i) => ({
  pnl_usd: i < 5 ? 2 : -1,
  pnl_pct: i < 5 ? 4 : -2,
  initial_value_usd: 50,
  range_efficiency: 75,
  minutes_held: 30 + i,
  open_session: "siang",
  narrative_category: "ai",
  active_setup: null,
  paper: false,
  recorded_at: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
}));
const longRule = "x".repeat(150);
writeFileSync(lessonsPath, JSON.stringify({ lessons: [{ id: 1, rule: longRule, tags: [], outcome: "manual" }], performance: perf }));
assert.strictEqual(lessons.getModePerformance().length, 8);
assert.strictEqual(lessons.getHourlyProfile().total_with_open_time, 8);
assert.strictEqual(lessons.getNarrativeProfile().total_with_category, 8);
assert.ok(lessons.getTimeProfileForPrompt()?.includes("TIME-OF-DAY"));
assert.ok(lessons.getNarrativeProfileForPrompt()?.includes("NARRATIVE PROFILE"));
assert.strictEqual(lessons.listLessons({ full: false }).lessons[0].rule.length, 120);
assert.strictEqual(lessons.listLessons({ full: true }).lessons[0].rule, longRule);

// Patch 24: rumah plugin 40 benar-benar menyisipkan kedua profile ke SCREENER.
config.experiments.narrativeProfileSignal = true;
const prompt = await import(pathToFileURL(join(target, "prompt.js")).href);
const plugin40 = await import(pathToFileURL(join(target, "zenpack-plugins/40-prompt-racikan.js")).href);
const transformed = plugin40.transformPrompt("SCREENER", prompt.buildSystemPrompt("SCREENER", {}, {}, null, null, null, null, null));
assert.ok(transformed.includes("TIME-OF-DAY (WIB)"));
assert.ok(transformed.includes("NARRATIVE PROFILE"));

console.log("lessons-read: 17 exports, empty/legacy/synthetic + prompt profiles PASS");
