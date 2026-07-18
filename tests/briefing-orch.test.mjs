// Gate 7.7: orchestration behavior against an installed sandbox, no live network.
import assert from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) throw new Error("pakai: node tests/briefing-orch.test.mjs <path-target>");

const dataDir = mkdtempSync(join(tmpdir(), "zp-briefing-orch-"));
const configPath = join(dataDir, "user-config.json");
const statePath = join(dataDir, "state.json");
process.env.MERIDIAN_DATA_DIR = dataDir;
process.env.MERIDIAN_CONFIG_PATH = configPath;
process.env.DRY_RUN = "true";
process.env.PAPER_SOL_BALANCE = "2";
process.env.LLM_BASE_URL = "http://fixture.invalid/v1";
process.env.LLM_API_KEY = "";
process.env.TELEGRAM_BOT_TOKEN = "fixture-token";
process.env.TELEGRAM_CHAT_ID = "777";
process.chdir(dataDir);

writeFileSync(configPath, JSON.stringify({
  dryRun: true,
  telegramChatId: "777",
  gasReserve: 0.2,
  gasReserveAutoTune: false,
  gasReserveBufferDays: 14,
  gasReserveFloorSol: 0.03,
}));
writeFileSync(statePath, JSON.stringify({
  positions: {}, recentEvents: [], _lastBriefingPinId: 41,
}));
writeFileSync(join(dataDir, "lessons.json"), JSON.stringify({
  lessons: [],
  performance: [
    {
      position: "paper_fixture", pool_name: "FIXTURE", strategy: "spot",
      paper: true, active_setup: null, pnl_usd: 2, pnl_pct: 4,
      initial_value_usd: 50, fees_earned_usd: 0.5, range_efficiency: 80,
      minutes_in_range: 50, minutes_held: 60, close_reason: "fixture",
      recorded_at: new Date().toISOString(), closed_at: new Date().toISOString(),
    },
    {
      position: "live_fixture", pool_name: "LIVE-FIXTURE", strategy: "spot",
      paper: false, active_setup: "alpha", pnl_usd: 1, pnl_pct: 2,
      initial_value_usd: 50, fees_earned_usd: 0.2, range_efficiency: 75,
      minutes_in_range: 40, minutes_held: 60, close_reason: "fixture",
      recorded_at: new Date().toISOString(), closed_at: new Date().toISOString(),
    },
  ],
}));
writeFileSync(join(dataDir, "llm-cost-log.json"), "[]");
writeFileSync(join(dataDir, "gas-log.json"), "[]");

let nextMessageId = 42;
const telegramCalls = [];
globalThis.fetch = async (url, options = {}) => {
  const method = String(url).split("/").pop();
  const body = options.body ? JSON.parse(options.body) : {};
  telegramCalls.push({ method, body });
  return {
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({ ok: true, result: { message_id: nextMessageId++ } }),
  };
};

const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
const loaded = await loadPlugins(join(target, "zenpack-plugins"), hooks);
assert.deepStrictEqual(loaded.errors, [], `plugin errors: ${JSON.stringify(loaded.errors)}`);
const orch = await import(pathToFileURL(join(target, "zenpack-plugins/80-briefing-orch.js")).href);
const { config } = await import(pathToFileURL(join(target, "config.js")).href);

let pass = 0;
async function t(name, fn) {
  await fn();
  console.log("  ✅", name);
  pass++;
}

async function fire(event, text) {
  const replies = [];
  const ctx = await hooks.run(event, {
    text,
    channel: event === "repl:command" ? "repl" : "telegram",
    reply: async (value) => { replies.push(String(value)); },
  });
  return { ctx, replies };
}

await t("/briefing alltime pins new then unpins previous", async () => {
  const { ctx } = await fire("telegram:command", "/briefing alltime");
  assert.strictEqual(ctx.handled, true);
  const pin = telegramCalls.find((c) => c.method === "pinChatMessage");
  const unpin = telegramCalls.find((c) => c.method === "unpinChatMessage");
  assert.strictEqual(pin?.body.message_id, 42);
  assert.strictEqual(unpin?.body.message_id, 41);
  assert.strictEqual(JSON.parse(readFileSync(statePath, "utf8"))._lastBriefingPinId, 42);
});

await t("/report setups consumes argument and replies as HTML", async () => {
  const before = telegramCalls.length;
  const { ctx } = await fire("telegram:command", "/report setups");
  assert.strictEqual(ctx.handled, true);
  const calls = telegramCalls.slice(before).filter((c) => c.method === "sendMessage");
  assert.ok(calls.some((c) => /Racikan di log performa/.test(c.body.text)));
  assert.ok(calls.some((c) => c.body.parse_mode === "HTML"));
});

await t("REPL /report uses shared handled hook and stdout reply", async () => {
  const { ctx, replies } = await fire("repl:command", "/report setups");
  assert.strictEqual(ctx.handled, true);
  assert.ok(replies.some((s) => /Racikan di log performa/.test(s)));
  assert.ok(replies.every((s) => !/<[^>]+>/.test(s)));
});

await t("weekly/monthly cron definitions are exact UTC fork schedules", async () => {
  const src = readFileSync(join(target, "index.js"), "utf8");
  assert.ok(src.includes("cron.schedule(`30 1 * * 1`"));
  assert.ok(src.includes("cron.schedule(`0 2 1 * *`"));
  assert.ok(src.includes('{ period: "week" }'));
  assert.ok(src.includes('{ period: "month" }'));
  assert.ok((src.match(/timezone: 'UTC'/g) || []).length >= 4);
  assert.ok(src.includes("briefingWatchdog, weeklyTask, monthlyTask"));
});

await t("periodic week/month dry-run persists dedup keys", async () => {
  await orch.runPeriodicBriefing("week");
  await orch.runPeriodicBriefing("month");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.match(state._lastBriefing_week, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(state._lastBriefing_month, /^\d{4}-\d{2}$/);
});

await t("autoTune OFF is a config no-op", async () => {
  config.management.gasReserve = 0.2;
  config.management.gasReserveAutoTune = false;
  const before = readFileSync(configPath, "utf8");
  await orch.maybeAutoTuneGasReserve();
  assert.strictEqual(config.management.gasReserve, 0.2);
  assert.strictEqual(readFileSync(configPath, "utf8"), before);
});

await t("autoTune ON uses 8 real records and persists fork target", async () => {
  const first = new Date().toISOString();
  writeFileSync(join(dataDir, "gas-log.json"), JSON.stringify(Array.from({ length: 8 }, (_, i) => ({
    ts: i ? new Date().toISOString() : first,
    action: "fixture",
    sig: `fixture-${i}`,
    sol: 0.0875,
  }))));
  config.management.gasReserveAutoTune = true;
  config.management.gasReserveBufferDays = 14;
  config.management.gasReserveFloorSol = 0.03;
  config.management.gasReserve = 0.2;
  await orch.maybeAutoTuneGasReserve();
  assert.strictEqual(config.management.gasReserve, 9.8);
  assert.strictEqual(JSON.parse(readFileSync(configPath, "utf8")).gasReserve, 9.8);
});

console.log(`\nBRIEFING-ORCH: ${pass}/${pass} lolos`);
process.exit(0); // Solana SDK may retain an idle HTTP handle after wallet fixtures.
