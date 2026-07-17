// Gate 6.5 write-layer: seluruh fixture sintetis di data-dir temporer.
import assert from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) throw new Error("pakai: node tests/lessons-write.test.mjs <path-target>");

const dataDir = mkdtempSync(join(tmpdir(), "zp-lessons-write-"));
const userConfigPath = join(dataDir, "user-config.json");
const weightsPath = join(dataDir, "signal-weights.json");
const lessonsPath = join(dataDir, "lessons.json");
process.env.MERIDIAN_DATA_DIR = dataDir;
process.env.MERIDIAN_CONFIG_PATH = userConfigPath;
process.env.DRY_RUN = "false";
process.env.TELEGRAM_BOT_TOKEN = "";

const signalNames = [
  "organic_score", "fee_tvl_ratio", "volume", "mcap", "holder_count",
  "smart_wallets_present", "narrative_quality", "study_win_rate",
  "hive_consensus", "volatility", "entry_mcap", "entry_tvl", "entry_volume",
];
const initialUserConfig = JSON.stringify({ minFeeActiveTvlRatio: 0.05, minOrganic: 60 }, null, 2);
const initialWeights = JSON.stringify({
  weights: Object.fromEntries(signalNames.map((name) => [name, 1])),
  last_recalc: null,
  recalc_count: 0,
  history: [],
}, null, 2);
writeFileSync(userConfigPath, initialUserConfig);
writeFileSync(weightsPath, initialWeights);

const lessons = await import(pathToFileURL(join(target, "lessons.js")).href);
const { config } = await import(pathToFileURL(join(target, "config.js")).href);
config.activeSetup = null;
config.learning = { evolveEnabled: true };
config.experiments = { ...(config.experiments || {}), paperTrading: false, usePaperHistoryWhenLive: false };
config.darwin = { ...config.darwin, enabled: true, minSamples: 5, windowDays: 60 };
config.hiveMind = { ...(config.hiveMind || {}), url: "", apiKey: "" };

let pass = 0;
async function t(name, fn) {
  await fn();
  console.log("  ✅", name);
  pass++;
}

function syntheticPerf(i, { paper = false, pnlPct = i < 3 ? 10 : -10, closeReason = "fixture close" } = {}) {
  const winner = pnlPct > 0;
  return {
    position: `fixture_${paper ? "paper" : "live"}_${i}_${pnlPct}`,
    pool: null,
    pool_name: `FIXTURE-${i}`,
    strategy: "spot",
    bin_range: 35,
    bin_step: 100,
    volatility: winner ? 20 : 80,
    fee_tvl_ratio: winner ? 0.5 : 0.01,
    organic_score: winner ? 90 : 60,
    volume: winner ? 1000 : 100,
    initial_value_usd: 100,
    final_value_usd: 100 + pnlPct,
    fees_earned_usd: 0,
    minutes_in_range: 90,
    minutes_held: 100,
    close_reason: closeReason,
    active_setup: null,
    paper,
  };
}

// Writer test wajib memulihkan user-config/weights walau assertion gagal.
const userConfigBackup = readFileSync(userConfigPath);
const weightsBackup = readFileSync(weightsPath);
try {
  await t("suspect: -95 non-stopLoss flagged; stop loss/-50 clean; count reads one", async () => {
    await lessons.recordPerformance(syntheticPerf(90, { pnlPct: -95, closeReason: "manual close" }));
    await lessons.recordPerformance(syntheticPerf(91, { pnlPct: -95, closeReason: "stop loss" }));
    await lessons.recordPerformance(syntheticPerf(92, { pnlPct: -50, closeReason: "manual close" }));
    const data = JSON.parse(readFileSync(lessonsPath, "utf8"));
    assert.strictEqual(data.performance.length, 3);
    assert.strictEqual(data.performance[0].suspect_pnl, true);
    assert.strictEqual(data.performance[0].suspect_reason, "≤-90% non-stopLoss, verifikasi rug vs bad-data");
    assert.strictEqual(data.performance[1].suspect_pnl, undefined);
    assert.strictEqual(data.performance[2].suspect_pnl, undefined);
    assert.strictEqual(data.lessons.find((l) => l.suspect)?.suspect, true);
    assert.strictEqual(lessons.getSuspectCount(), 1);
    lessons.clearAllLessons();
    lessons.clearPerformance();
  });

  await t("evolve LAPIS paper: 5 close leaves config and Darwin bytes unchanged", async () => {
    config.experiments.paperTrading = true;
    process.env.DRY_RUN = "true";
    const configBefore = readFileSync(userConfigPath);
    const weightsBefore = readFileSync(weightsPath);
    for (let i = 0; i < 5; i++) await lessons.recordPerformance(syntheticPerf(i, { paper: true }));
    assert.deepStrictEqual(readFileSync(userConfigPath), configBefore);
    assert.deepStrictEqual(readFileSync(weightsPath), weightsBefore);
    const data = JSON.parse(readFileSync(lessonsPath, "utf8"));
    assert.strictEqual(data.performance.length, 5);
    assert.ok(data.performance.every((row) => row.paper));
    assert.ok(data.lessons.every((lesson) => lesson.paper));
    lessons.clearAllLessons();
    lessons.clearPerformance();
  });

  await t("evolve LAPIS live: close ke-5 moves fork threshold and Darwin", async () => {
    config.experiments.paperTrading = false;
    process.env.DRY_RUN = "false";
    const configBefore = readFileSync(userConfigPath);
    const weightsBefore = readFileSync(weightsPath);
    for (let i = 0; i < 5; i++) await lessons.recordPerformance(syntheticPerf(i));
    const evolved = JSON.parse(readFileSync(userConfigPath, "utf8"));
    assert.strictEqual(evolved.minFeeActiveTvlRatio, 0.06);
    assert.strictEqual(config.screening.minFeeActiveTvlRatio, 0.06);
    assert.notDeepStrictEqual(readFileSync(userConfigPath), configBefore);
    assert.notDeepStrictEqual(readFileSync(weightsPath), weightsBefore);
    const data = JSON.parse(readFileSync(lessonsPath, "utf8"));
    assert.ok(data.lessons.some((lesson) => lesson.rule.startsWith("[AUTO-EVOLVED @ 5 positions]")));
  });

  await t("dedup identical rule stores one; removeLesson removes by ID", () => {
    lessons.clearAllLessons();
    lessons.addLesson("IDENTICAL FIXTURE RULE", ["fixture"]);
    lessons.addLesson("IDENTICAL FIXTURE RULE", ["fixture"], { pinned: true });
    const listed = lessons.listLessons({ full: true });
    assert.strictEqual(listed.total, 1);
    assert.strictEqual(listed.lessons[0].rule, "IDENTICAL FIXTURE RULE");
    assert.strictEqual(listed.lessons[0].pinned, true);
    assert.strictEqual(lessons.removeLesson(listed.lessons[0].id), 1);
    assert.strictEqual(lessons.removeLesson(listed.lessons[0].id), 0);
    assert.strictEqual(lessons.listLessons().total, 0);
  });

  await t("paper prompt: visible DRY_RUN, hidden live default, opt-in visible + 🧪", () => {
    writeFileSync(lessonsPath, JSON.stringify({
      lessons: [
        { id: 1, rule: "PAPER ONLY FIXTURE", tags: [], outcome: "manual", paper: true, created_at: "2026-07-01T00:00:00.000Z" },
        { id: 2, rule: "SUSPECT ONLY FIXTURE", tags: [], outcome: "bad", suspect: true, created_at: "2026-07-02T00:00:00.000Z" },
      ],
      performance: [],
    }));

    config.experiments.paperTrading = true;
    config.experiments.usePaperHistoryWhenLive = false;
    process.env.DRY_RUN = "true";
    const paperPrompt = lessons.getLessonsForPrompt();
    assert.match(paperPrompt, /🧪 \[MANUAL\].*PAPER ONLY FIXTURE/);
    assert.doesNotMatch(paperPrompt, /SUSPECT ONLY FIXTURE/);

    config.experiments.paperTrading = false;
    process.env.DRY_RUN = "false";
    assert.strictEqual(lessons.getLessonsForPrompt(), null);

    config.experiments.usePaperHistoryWhenLive = true;
    const optedIn = lessons.getLessonsForPrompt();
    assert.match(optedIn, /🧪 \[MANUAL\].*PAPER ONLY FIXTURE/);
    assert.doesNotMatch(optedIn, /SUSPECT ONLY FIXTURE/);
  });
} finally {
  writeFileSync(userConfigPath, userConfigBackup);
  writeFileSync(weightsPath, weightsBackup);
}

console.log(`\nLESSONS-WRITE: ${pass}/${pass} lolos`);
