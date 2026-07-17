// Gate 6.6: tiga export briefing pada fixture sintetis terisolasi, tanpa network.
import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) throw new Error("pakai: node tests/briefing-full.test.mjs <path-target>");

const dataDir = mkdtempSync(join(tmpdir(), "zp-briefing-full-"));
process.env.MERIDIAN_DATA_DIR = dataDir;
process.env.MERIDIAN_CONFIG_PATH = join(dataDir, "user-config.json");
process.env.DRY_RUN = "true";
process.env.PAPER_SOL_BALANCE = "2";
process.env.LLM_BASE_URL = "http://fixture.invalid/v1"; // disables OpenRouter calls
process.env.LLM_API_KEY = "";
process.chdir(dataDir); // hardcoded ./logs in fork also stays inside the fixture

writeFileSync(join(dataDir, "user-config.json"), JSON.stringify({
  dryRun: true,
  preset: "fixture",
  activeSetup: null,
}));

const now = new Date().toISOString();
const perf = [
  {
    position: "paper_fixture_win", pool_name: "FIX-WIN", strategy: "spot",
    paper: true, active_setup: null, pnl_usd: 5, pnl_pct: 10,
    initial_value_usd: 50, fees_earned_usd: 1, range_efficiency: 90,
    minutes_in_range: 50, minutes_held: 60, close_reason: "fixture win",
    recorded_at: now, closed_at: now,
  },
  {
    position: "paper_fixture_loss", pool_name: "FIX-LOSS", strategy: "bid_ask",
    paper: true, active_setup: null, pnl_usd: -2, pnl_pct: -4,
    initial_value_usd: 50, fees_earned_usd: 0.5, range_efficiency: 70,
    minutes_in_range: 35, minutes_held: 60, close_reason: "fixture loss",
    recorded_at: now, closed_at: now,
  },
];
const lessonsFixture = {
  performance: perf,
  lessons: [{
    id: 1, paper: true, outcome: "good", confidence: 0.9,
    rule: "PREFER synthetic fixture", tags: ["worked"], created_at: now,
  }],
};
const stateFixture = {
  positions: {
    paper_fixture_win: { position: "paper_fixture_win", deployed_at: now, closed: true, closed_at: now },
  },
  recentEvents: [],
};
writeFileSync(join(dataDir, "lessons.json"), JSON.stringify(lessonsFixture));
writeFileSync(join(dataDir, "state.json"), JSON.stringify(stateFixture));
writeFileSync(join(dataDir, "llm-cost-log.json"), JSON.stringify([
  { ts: now, role: "SCREENER", model: "fixture", cost: 0.01, tokens: 100 },
]));

const { config } = await import(pathToFileURL(join(target, "config.js")).href);
config.activeSetup = null;
config.experiments = { ...(config.experiments || {}), paperTrading: true, counterfactualReview: false };
config.reports = { learningReportEvery: 10, learningReportTrendN: 10 };

const briefing = await import(pathToFileURL(join(target, "briefing.js")).href);
let pass = 0;
function t(name, fn) {
  fn();
  console.log("  ✅", name);
  pass++;
}

const daily = await briefing.generateBriefing();
t("generateBriefing DRY_RUN membentuk laporan sintetis", () => {
  assert.match(daily, /Morning Briefing/);
  assert.match(daily, /FIX-WIN|2 closed|Performance/);
  assert.match(daily, /🧪 simulasi/);
});

const weekly = await briefing.generatePeriodicBriefing("week");
t("generatePeriodicBriefing week direct-export aman", () => {
  assert.match(weekly, /Weekly Briefing/);
  assert.match(weekly, /Activity \(7d\)/);
});

const milestone = briefing.buildMilestoneReport(perf, 2);
t("buildMilestoneReport direct-export aman", () => {
  assert.match(milestone, /Learning Report — 2 closed positions/);
  assert.match(milestone, /All-time/);
});

writeFileSync(join(dataDir, "lessons.json"), JSON.stringify({ lessons: [], performance: [] }));
writeFileSync(join(dataDir, "state.json"), JSON.stringify({ positions: {}, recentEvents: [] }));
const empty = await briefing.generateBriefing({ allTimeDeep: true });
t("generateBriefing empty dataset + varian argumen fail-open", () => {
  assert.match(empty, /Morning Briefing/);
  assert.match(empty, /Win Rate \(24h\): N\/A/);
});

console.log(`\nBRIEFING-FULL: ${pass}/${pass} lolos`);
