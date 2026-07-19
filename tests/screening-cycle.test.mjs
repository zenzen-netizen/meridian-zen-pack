import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
const pack = process.argv[3];
if (!target || !pack) {
  console.error("pakai: node tests/screening-cycle.test.mjs <path-target> <path-pack>");
  process.exit(1);
}
process.chdir(target);
process.env.DRY_RUN = "true";
process.env.OPENROUTER_API_KEY ||= "dummy";
process.env.WALLET_PRIVATE_KEY ||= "11111111111111111111111111111111";
process.env.RPC_URL ||= "http://127.0.0.1:8899";

const plugin = await import(pathToFileURL(join(target, "zenpack-plugins/90-screening-cycle.js")).href);
const gmgn = await import(pathToFileURL(join(target, "tools/gmgn.js")).href);
const { config } = await import(pathToFileURL(join(target, "config.js")).href);

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (e) { console.log("  ❌", name, "→", e.message); fail++; }
}

Object.assign(config.management, {
  sizingMode: "maximize", gasReserve: 0.05, rentPerPositionSol: 0.057,
});
config.risk.maxPositions = 3;
config.strategy.strategy = "spot";
config.strategy.strategyLock = "default";
config.darwin = { enabled: false };
config.experiments = {
  marketRegimeGate: false, marketRegimeMaxDrop24hPct: 8,
  candidateMomentum: false, expectedYieldSignal: false,
  smartWalletMomentum: false,
};

const pools = [1, 2].map((n) => ({
  gmgn: true, pool: `POOL${n}`, name: `TOK${n}/SOL`,
  base: { mint: `MINT${n}`, symbol: `TOK${n}` },
  bin_step: 80, fee_pct: 1, fee_active_tvl_ratio: 0.2,
  volume_window: 50_000, tvl: 20_000, active_tvl: 18_000,
  volatility: 1.25, mcap: 100_000, token_age_hours: 2,
  organic_score: 80, holders: 900, gmgn_total_fee_sol: 40,
  gmgn_smart_wallets: 1, gmgn_kol_wallets: 1,
}));

function makeRuntime(capture = {}, overrides = {}) {
  return {
    agentLoop: async (...args) => {
      capture.prompt = args[0]; capture.options = args[6];
      return { content: "⛔ NO DEPLOY\n\nCycle finished with no valid entry." };
    },
    getMyPositions: async () => ({ total_positions: 0, positions: [] }),
    getActiveBin: async () => ({ binId: 100 }),
    getWalletBalances: async () => ({ sol: 2, sol_price: 100 }),
    getSolMarketRegime: async () => ({ change24hPct: 2 }),
    getTopCandidates: async () => ({ candidates: pools, stage_counts: null, all_filtered: [] }),
    getActiveStrategy: () => null,
    recallForPool: () => null,
    recordCandidateSnapshots: () => { capture.snapshots = (capture.snapshots || 0) + 1; },
    recordSmartWalletCounts: () => { capture.smartRecords = (capture.smartRecords || 0) + 1; },
    getCandidateMomentum: () => ({ priceChangePct: 12 }),
    formatCandidateMomentum: () => "price +12%",
    getSmartWalletMomentum: () => ({ delta: 2 }),
    formatSmartWalletMomentum: () => "+2 wallets",
    checkSmartWalletsOnPool: async () => ({ in_pool: [{ name: "smart" }] }),
    getTokenNarrative: async () => ({ narrative: "fixture narrative" }),
    getTokenInfo: async () => ({ results: [{ audit: { top_holders_pct: 10, bot_holders_pct: 2 }, global_fees_sol: 40 }] }),
    stageSignals: () => {}, getWeightsSummary: () => null,
    appendDecision: (row) => { (capture.decisions ||= []).push(row); },
    telegramEnabled: () => false, createLiveMessage: async () => null,
    sendMessage: async () => {},
    ...overrides,
  };
}

async function run(capture = {}, overrides = {}) {
  let marks = 0;
  const result = await plugin.runScreeningCycle({
    silent: true,
    markStarted: () => { marks++; },
    runtime: makeRuntime(capture, overrides),
  });
  capture.marks = marks;
  return result;
}

await t("market regime fixture skips risk-off before LLM; ZERO-TX", async () => {
  config.experiments.marketRegimeGate = true;
  const c = {}; let llm = 0, tx = 0;
  const out = await run(c, {
    getSolMarketRegime: async () => ({ change24hPct: -8.1 }),
    agentLoop: async () => { llm++; return { content: "bad" }; },
    executeTool: async () => { tx++; },
  });
  config.experiments.marketRegimeGate = false;
  assert.ok(out.includes("risk-off"));
  assert.strictEqual(llm, 0); assert.strictEqual(tx, 0); assert.strictEqual(c.marks, 0);
});

await t("candidate momentum fixture reaches prompt; ZERO-TX", async () => {
  config.experiments.candidateMomentum = true;
  const c = {}; const out = await run(c);
  config.experiments.candidateMomentum = false;
  assert.ok(c.prompt.includes("momentum: price +12%"));
  assert.ok(out.includes("NO DEPLOY")); assert.strictEqual(c.options.allowNoToolFinal, true);
});

await t("expected yield fixture reaches prompt; ZERO-TX", async () => {
  config.experiments.expectedYieldSignal = true;
  const c = {}; await run(c);
  config.experiments.expectedYieldSignal = false;
  assert.ok(c.prompt.includes("yield_to_me:"));
  assert.ok(c.prompt.includes("proxy — ignores bin concentration"));
});

await t("smart-wallet momentum fixture reaches prompt; ZERO-TX", async () => {
  config.experiments.smartWalletMomentum = true;
  const c = {}; await run(c);
  config.experiments.smartWalletMomentum = false;
  assert.ok(c.prompt.includes("sw_momentum: +2 wallets"));
});

await t("shadow recorders stay alive with all experiments OFF", async () => {
  const c = {}; await run(c);
  assert.strictEqual(c.snapshots, 1); assert.strictEqual(c.smartRecords, 1);
  assert.strictEqual(c.marks, 1);
});

await t("GMGN funnel fixture renders stage counts and reasons", async () => {
  const c = {};
  const out = await run(c, {
    getTopCandidates: async () => ({
      candidates: [],
      stage_counts: { ranked: 10, s1: 8, s2: 4, s3: 2, s4: 1, s5: 0 },
      all_filtered: [{ stage: 3, name: "BAD", reason: "no pool" }],
      filtered_examples: [{ name: "BAD", reason: "no pool" }],
    }),
  });
  assert.ok(out.includes("GMGN funnel: ranked=10 → S1=8 → S2=4 → S3=2 → S4=1 → final=0"));
  assert.ok(out.includes("S3 pool")); assert.ok(out.includes("BAD: no pool"));
});

await t("fake DEPLOYED report is replaced; ZERO-TX", async () => {
  const c = {}; let tx = 0;
  const out = await run(c, {
    agentLoop: async (...args) => { c.options = args[6]; return { content: "🚀 DEPLOYED\n\nfiction" }; },
    executeTool: async () => { tx++; },
  });
  assert.ok(out.includes("⛔ NO DEPLOY")); assert.ok(out.includes("no position was actually opened"));
  assert.strictEqual(tx, 0);
});

await t("successful deploy callback preserves report without real TX", async () => {
  const c = {};
  const out = await run(c, {
    agentLoop: async (...args) => {
      const opts = args[6];
      await opts.onToolStart({ name: "deploy_position" });
      await opts.onToolFinish({ name: "deploy_position", result: { success: true, paper: true, txs: [] }, success: true });
      return { content: "🚀 DEPLOYED\n\nfixture paper deploy" };
    },
  });
  assert.ok(out.includes("🚀 DEPLOYED")); assert.ok(!out.includes("⛔ NO DEPLOY"));
});

await t("bounded GMGN producer fixture completes five stages", async () => {
  const oldFetch = globalThis.fetch;
  Object.assign(config.gmgn, {
    apiKey: "fixture", requestDelayMs: 0, maxRetries: 0, interval: "5m",
    minMcap: 1, maxMcap: 1_000_000, maxBundlerRate: 1,
    minTokenAgeHours: null, maxTokenAgeHours: null, minVolume: 1,
    enrichLimit: 1, minHolders: 1, minTotalFeeSol: 1,
    maxTop10HolderRate: 1, maxDevTeamHoldRate: 1, maxBotDegenRate: 1,
    maxFreshWalletRate: 1, maxRatTraderRate: 1, maxSniperHoldRate: 1,
    preferredKolNames: [], dumpKolNames: [], preferredKolMinHoldPct: 0,
    dumpKolMinHoldPct: 0.5, indicatorFilter: false,
  });
  config.gmgn.minTvl = 1;
  const mint = "MINTFIX";
  globalThis.fetch = async (url) => {
    const s = String(url);
    const json = s.includes("/v1/market/rank")
      ? { data: [{ address: mint, symbol: "FIX", market_cap: 100_000, bundler_rate: 0, volume: 50_000, holder_count: 900 }] }
      : s.includes("/v1/token/info")
        ? { data: { address: mint, symbol: "FIX", holder_count: 900, total_fee: 40, trade_fee: 20, price: 1, stat: {}, wallet_tags_stat: {} } }
        : s.includes("token_top_holders") || s.includes("token_top_traders")
          ? { data: [] }
          : s.includes("dlmm.datapi.meteora.ag/pools")
            ? { data: [{ address: "POOLFIX", name: "FIX-SOL", tvl: 20_000, token_x: { address: mint, symbol: "FIX" }, token_y: { address: config.tokens.SOL, symbol: "SOL" }, pool_config: { bin_step: 80, base_fee_pct: 1 } }] }
            : { data: [{ pool_address: "POOLFIX", tvl: 20_000, active_tvl: 18_000, fee_active_tvl_ratio: 0.2, volatility: 1.25 }] };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(json), json: async () => json };
  };
  try {
    const out = await gmgn.discoverGmgnPools({ limit: 1 });
    assert.deepStrictEqual(out.stage_counts, { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1 });
    assert.strictEqual(out.pools[0].gmgn, true);
    assert.strictEqual(out.pools[0].volatility, 1.25);
  } finally { globalThis.fetch = oldFetch; }
});

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} missing`);
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${name} unterminated`);
}

await t("adaptive throttle OFF parity and weak-session stretch", () => {
  const src = readFileSync(join(target, "index.js"), "utf8");
  const a = extractFunction(src, "effectiveScreeningIntervalMin");
  const b = extractFunction(src, "shouldRunScheduledScreening");
  const cfg = { schedule: { screeningIntervalMin: 10, adaptiveScreening: false, maxScreeningIntervalMin: 90 } };
  const timers = { screeningLastRun: Date.now() - 20 * 60_000 };
  const make = (klass) => new Function("config", "timers", "classifySession", "currentWibSession", `${a};${b};return { effectiveScreeningIntervalMin, shouldRunScheduledScreening };`)(cfg, timers, () => klass, () => ({ key: "x", label: "X" }));
  assert.strictEqual(make("weak").shouldRunScheduledScreening(), true);
  cfg.schedule.adaptiveScreening = true;
  assert.strictEqual(make("weak").effectiveScreeningIntervalMin(), 90);
  assert.strictEqual(make("weak").shouldRunScheduledScreening(), false);
  assert.strictEqual(make("ok").effectiveScreeningIntervalMin(), 10);
  assert.strictEqual(make("ok").shouldRunScheduledScreening(), true);
});

await t("core choke point forbids mid-cycle vanilla fallback", () => {
  const src = readFileSync(join(target, "index.js"), "utf8");
  const begin = src.indexOf("[zen-pack:32-screening-cycle]");
  const vanilla = src.indexOf("// Hard guards — don't even run", begin);
  const block = src.slice(begin, vanilla);
  assert.ok(block.includes("if (!zpScreenCtx.started)"));
  assert.ok(block.includes("if (zpScreenCtx.handled)"));
  assert.ok(block.includes("return zpScreenCtx.result"));
  assert.ok(block.includes("never fall through into vanilla"));
  assert.ok(src.includes("Opportunity-triggered screening failed"));
  assert.ok(src.includes("degenScore"));
});

await t("cycle body golden matches fork after lifecycle adapter", () => {
  let expected = readFileSync(join(pack, "core-patches/snip32/cycle-fork.txt"), "utf8").trimEnd();
  expected = expected.replace("export async function runScreeningCycle({ silent = false } = {}) {\n  if (_screeningBusy) {\n    log(\"cron\", \"Screening skipped — previous cycle still running\");\n    return null;\n  }\n  _screeningBusy = true; // set immediately — prevents TOCTOU race with concurrent callers\n  _screeningLastTriggered = Date.now();",
`export async function runScreeningCycle(ctx = {}) {
  const { silent = false } = ctx;
  const {
    agentLoop, getMyPositions, getActiveBin, getWalletBalances, getSolMarketRegime,
    getTopCandidates, getActiveStrategy, recallForPool, recordCandidateSnapshots,
    recordSmartWalletCounts, getCandidateMomentum, formatCandidateMomentum,
    getSmartWalletMomentum, formatSmartWalletMomentum, checkSmartWalletsOnPool,
    getTokenNarrative, getTokenInfo, stageSignals, getWeightsSummary, appendDecision,
    telegramEnabled, createLiveMessage, sendMessage,
  } = ctx.runtime || runtime;`);
  expected = expected.replace("  timers.screeningLastRun = Date.now();", "  ctx.markStarted();");
  expected = expected.replace(/^\s*_screeningBusy = false;[^\n]*\n/gm, "");
  expected = expected.replace(/^\s*drainTelegramQueue\(\)\.catch\(\(\) => \{\}\);\n/gm, "");
  const actualSrc = readFileSync(join(target, "zenpack-plugins/90-screening-cycle.js"), "utf8");
  const start = actualSrc.indexOf("export async function runScreeningCycle(");
  const end = actualSrc.indexOf("\n\nexport function register", start);
  assert.strictEqual(actualSrc.slice(start, end).trimEnd(), expected);
});

console.log(`\nscreening-cycle: ${pass} passed, ${fail} failed · ZERO-TX`);
process.exit(fail ? 1 : 0);
