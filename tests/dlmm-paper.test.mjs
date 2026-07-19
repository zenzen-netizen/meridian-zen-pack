// Gerbang 6.2/6.4: paper lifecycle wiring + reports gas estimator.
import assert from "node:assert";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/dlmm-paper.test.mjs <path-target>"); process.exit(1); }

const src = await readFile(join(target, "tools/dlmm.js"), "utf8");
let pass = 0;
const t = async (name, fn) => { await fn(); console.log("  ✅", name); pass++; };

await t("A0 imports paper + dual-side wallet + existing state + reports", () => {
  assert.match(src, /getTrackedPosition,\n  getTrackedPositions,\n  minutesOutOfRange,/);
  assert.match(src, /import \{ normalizeMint, getWalletBalances, swapToken \} from "\.\/wallet\.js";/);
  assert.match(src, /import \{ estimateGasSol \} from "\.\.\/reports\.js";/);
  assert.doesNotMatch(src, /import \{ estimateGasSol \} from "\.\.\/zenpack-lib\/gas-est\.js";/);
  for (const name of ["isPaperMode", "makePaperPositionId", "simulatePaperMetrics", "timeframeMinutes", "classifyPaperEdge", "formatPaperDecomposition"]) {
    assert.match(src, new RegExp(`\\b${name}\\b`));
  }
});

await t("A1 deploy branch restores full fork dual-side range", () => {
  assert.match(src, /narrative_category, \/\/ 🧪 #7: optional narrative bucket for performance learning/);
  assert.match(src, /const pMaxBinId = \(isSingleSidedSol && !dualSide\) \? activeBin\.binId : activeBin\.binId \+ activeBinsAbove;/);
  assert.doesNotMatch(src, /ZP-6\.2: !dualSide ditunda/);
  assert.match(src, /strategy: dualSide \? \(config\.strategy\.dualSideStrategy === "spot" \? "Spot" : "BidAsk"\)/);
  assert.match(src, /percentX: dualSide \? dualSideTokenPct/);
  assert.match(src, /\[PAPER\] tracked virtual position/);
});

await t("A2/A3/A4 lifecycle routes are present", () => {
  assert.match(src, /Paper PnL simulation unavailable/);
  assert.match(src, /async function computePaperMetrics\(tracked\)/);
  assert.match(src, /return await getPaperPositions\(\{ silent \}\);/);
  assert.match(src, /return await closePaperPosition\(position_address, reason\);/);
});

const gas = await import(pathToFileURL(join(target, "reports.js")).href);
await t("reports keeps fork gas constants and estimator", () => {
  assert.deepStrictEqual(gas.GAS_EST_SOL, {
    deploy_position: 0.00004,
    close_position: 0.00003,
    claim_fees: 0.000015,
    swap_token: 0.000015,
  });
  assert.strictEqual(gas.estimateGasSol({ deploy_position: 1, close_position: 1, claim_fees: 1, swap_token: 1 }), 0.0001);
});

function instrumentDlmm(moduleSrc) {
  return moduleSrc
    .replace(
      /async function getDLMM\(\) \{[\s\S]*?\n\}\n\n\/\/ ─── Lazy wallet\/connection init/,
      "async function getDLMM() { return globalThis.__paperHarness.getDLMM; }\n\n// ─── Lazy wallet/connection init",
    )
    .replace(
      /function getWallet\(\) \{[\s\S]*?\n\}\n\nfunction shouldUseLpAgentRelay/,
      "function getWallet() { return globalThis.__paperHarness.wallet; }\n\nfunction shouldUseLpAgentRelay",
    )
    .replace(
      /async function getPool\(poolAddress\) \{[\s\S]*?\n\}\n\nsetInterval\(\(\) => poolCache\.clear\(\), 5 \* 60 \* 1000\);/,
      "async function getPool(poolAddress) { return globalThis.__paperHarness.pool; }\n\nsetInterval(() => poolCache.clear(), 5 * 60 * 1000).unref();",
    )
    .replace(
      "setInterval(() => poolMetadataCache.clear(), 15 * 60 * 1000);",
      "setInterval(() => poolMetadataCache.clear(), 15 * 60 * 1000).unref();",
    )
    .replaceAll("sendAndConfirmTransaction(", "(globalThis.__paperHarness.txCount++, sendAndConfirmTransaction)(");
}

const baselinePath = join(target, ".zenpack/backups/tools/dlmm.js.orig");
const runtimePatchedPath = join(target, `tools/.dlmm-paper-patched-${process.pid}.mjs`);
const runtimeBaselinePath = join(target, `tools/.dlmm-paper-baseline-${process.pid}.mjs`);
const statePath = join(target, "state.json");
const lessonsPath = join(target, "lessons.json");
const poolMemoryPath = join(target, "pool-memory.json");
const snapshot = async (path) => readFile(path).catch((e) => e.code === "ENOENT" ? null : Promise.reject(e));
const restore = async (path, content) => content == null ? rm(path, { force: true }) : writeFile(path, content);
const stateBefore = await snapshot(statePath);
const lessonsBefore = await snapshot(lessonsPath);
const poolMemoryBefore = await snapshot(poolMemoryPath);

try {
  await writeFile(runtimePatchedPath, instrumentDlmm(src));
  await writeFile(runtimeBaselinePath, instrumentDlmm(await readFile(baselinePath, "utf8")));

  globalThis.__paperHarness = {
    txCount: 0,
    wallet: { publicKey: { toString: () => "PaperWallet111111111111111111111111111111" } },
    pool: {
      lbPair: {
        tokenXMint: { toString: () => "BaseMint11111111111111111111111111111111" },
        binStep: 10,
        parameters: { baseFactor: 10 },
      },
      getActiveBin: async () => ({ binId: 100 }),
    },
    getDLMM: {
      StrategyType: { Spot: "spot", Curve: "curve", BidAsk: "bid_ask" },
      getBinIdFromPrice: (price) => Math.round((Number(price) - 1) * 1000),
      getPriceOfBinByBinId: (bin) => ({ toString: () => String(1 + Number(bin) / 1000) }),
    },
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [] }), text: async () => "" });
  process.env.DRY_RUN = "true";

  const { config } = await import(pathToFileURL(join(target, "config.js")).href);
  const stateApi = await import(pathToFileURL(join(target, "state.js")).href);
  const baseline = await import(`${pathToFileURL(runtimeBaselinePath).href}?t=${Date.now()}`);
  const patched = await import(`${pathToFileURL(runtimePatchedPath).href}?t=${Date.now()}`);
  const args = {
    pool_address: "PoolPaper1111111111111111111111111111111",
    amount_y: 0.5,
    strategy: "spot",
    bins_below: 35,
    bins_above: 0,
    pool_name: "PAPER-SOL",
    fee_tvl_ratio: 0.25,
  };

  config.experiments ??= {};
  config.experiments.paperTrading = false;
  await t("DUAL LAPIS 1 OFF parity + LAPIS 2 ON shape, ZERO-TX", async () => {
    config.strategy.dualSideEnabled = false;
    const before = await baseline.deployPosition({ ...args });
    const after = await patched.deployPosition({ ...args });
    assert.deepStrictEqual(after, before);
    assert.strictEqual(globalThis.__paperHarness.txCount, 0);
    console.log("     before:", JSON.stringify(before));
    console.log("     after :", JSON.stringify(after));
    console.log("     diff  : []");

    config.strategy.dualSideEnabled = true;
    config.strategy.dualSideTokenPct = 10;
    config.strategy.dualSideUpsidePct = 15;
    config.strategy.dualSideStrategy = "bid_ask";
    const dual = await patched.deployPosition({ ...args });
    assert.strictEqual(dual.dry_run, true);
    assert.ok(dual.would_deploy.bins_above > 0);
    assert.strictEqual(dual.would_deploy.amount_x, 0);
    assert.strictEqual(dual.would_deploy.amount_y, args.amount_y);
    assert.strictEqual(globalThis.__paperHarness.txCount, 0);
    console.log("     dual   :", JSON.stringify(dual.would_deploy));
    console.log("     strategy branch: dualSideStrategy/percentX exact fork (static assert)");
    console.log("     ZERO-TX:", globalThis.__paperHarness.txCount);
    config.strategy.dualSideEnabled = false;
  });

  config.experiments.paperTrading = true;
  await t("LAPIS 2 flag-ON: paper_* hidup + ZERO-TX", async () => {
    const deployed = await patched.deployPosition({ ...args, narrative_category: "meme" });
    assert.strictEqual(deployed.paper, true);
    assert.match(deployed.position, /^paper_/);
    const listed = await patched.getMyPositions({ force: true });
    assert.ok(listed.positions.some((p) => p.position === deployed.position));
    let tracked = stateApi.getTrackedPosition(deployed.position);
    assert.ok(tracked.deployed_at, "paper deploy harus punya deployed_at");
    assert.strictEqual(tracked.trough_pnl_pct, 0);
    assert.strictEqual(tracked.price_peak_pct, 0);
    assert.strictEqual(tracked.price_trough_pct, 0);

    stateApi.confirmPeak(deployed.position, 7.5, 1);
    stateApi.updatePnlAndCheckExits(deployed.position, {
      pnl_pct: -2.5,
      pnl_pct_suspicious: false,
      in_range: true,
      active_bin: 99,
      fee_per_tvl_24h: 10,
      age_minutes: 1,
    }, { ...config.management, trailingTakeProfit: false, minFeePerTvl24h: null });
    tracked = stateApi.getTrackedPosition(deployed.position);
    assert.strictEqual(tracked.peak_pnl_pct, 7.5);
    assert.strictEqual(tracked.trough_pnl_pct, -2.5);
    assert.ok(tracked.price_trough_pct < 0);

    const pnl = await patched.getPositionPnl({ pool_address: args.pool_address, position_address: deployed.position });
    assert.strictEqual(pnl.paper, true);
    const closed = await patched.closePosition({ position_address: deployed.position, reason: "paper harness" });
    assert.strictEqual(closed.paper, true);
    assert.strictEqual(closed.peak_pnl_pct, 7.5, "paper close shape harus bawa peakPnl");
    assert.strictEqual(globalThis.__paperHarness.txCount, 0);
    console.log("     position:", deployed.position);
    console.log("     listed  :", listed.positions.map((p) => p.position).join(","));
    console.log("     close   :", JSON.stringify({ success: closed.success, paper: closed.paper, pnl_pct: closed.pnl_pct, peak_pnl_pct: closed.peak_pnl_pct }));
    console.log("     ZERO-TX :", globalThis.__paperHarness.txCount);
  });
} finally {
  await restore(statePath, stateBefore);
  await restore(lessonsPath, lessonsBefore);
  await restore(poolMemoryPath, poolMemoryBefore);
  await rm(runtimePatchedPath, { force: true });
  await rm(runtimeBaselinePath, { force: true });
  delete globalThis.__paperHarness;
}

console.log(`\nDLMM-PAPER: ${pass}/${pass} lolos`);
