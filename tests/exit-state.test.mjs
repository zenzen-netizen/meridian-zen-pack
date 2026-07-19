// Stage 7.9 gate: fork metadata producers on the untouched upstream 2-tick engine.
import assert from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/exit-state.test.mjs <path-target>"); process.exit(1); }

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (e) { console.log("  ❌", name, "→", e.message); fail++; }
}

const stateSrc = await readFile(join(target, "state.js"), "utf8");
const indexSrc = await readFile(join(target, "index.js"), "utf8");
const dlmmSrc = await readFile(join(target, "tools/dlmm.js"), "utf8");
const baseStateSrc = await readFile(join(target, ".zenpack/backups/state.js.orig"), "utf8");
const baseIndexSrc = await readFile(join(target, ".zenpack/backups/index.js.orig"), "utf8");

function functionBlock(src, signature) {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `signature hilang: ${signature}`);
  const open = src.indexOf("{", start);
  let depth = 0, quote = null, escaped = false, templateDepth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i], next = src[i + 1];
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (ch === "\\") { escaped = true; continue; }
      if (quote === "`" && ch === "$" && next === "{") { templateDepth++; i++; continue; }
      if (quote === "`" && ch === "}" && templateDepth) { templateDepth--; continue; }
      if (ch === quote && templateDepth === 0) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "/" && next === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (ch === "/" && next === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`function block tidak tertutup: ${signature}`);
}

await t("golden confirmPeak/registerExitSignal byte-identik vanilla", () => {
  assert.strictEqual(
    functionBlock(stateSrc, "export function confirmPeak"),
    functionBlock(baseStateSrc, "export function confirmPeak"),
  );
  assert.strictEqual(
    functionBlock(stateSrc, "export function registerExitSignal"),
    functionBlock(baseStateSrc, "export function registerExitSignal"),
  );
});

await t("golden poller 2-tick byte-identik vanilla", () => {
  const block = (src) => {
    const start = src.indexOf("  // Fast PnL poller");
    const end = src.indexOf("  }, pnlPollMs);", start) + "  }, pnlPollMs);".length;
    assert.ok(start >= 0 && end > start, "poller block hilang");
    return src.slice(start, end);
  };
  assert.strictEqual(block(indexSrc), block(baseIndexSrc));
});

await t("mesin 15s/emergency/cooldown tidak kembali", () => {
  for (const forbidden of [
    "schedulePeakConfirmation", "scheduleTrailingDropConfirmation",
    "resolvePendingPeak", "resolvePendingTrailingDrop", "_peakConfirmTimers",
    "_trailingDropConfirmTimers", "TRAILING_PEAK_CONFIRM_DELAY_MS",
    "TRAILING_DROP_CONFIRM_DELAY_MS", "_pollTriggeredAt", "emergencyCloseDirect",
    "pending_trailing_current_pnl_pct", "confirmed_trailing_exit_until",
  ]) {
    assert.ok(!indexSrc.includes(forbidden) && !stateSrc.includes(forbidden), `${forbidden} bocor`);
  }
});

await t("dlmm wires ensureDeployedAt + paper peak shape", () => {
  assert.match(dlmmSrc, /syncOpenPositions,\n  ensureDeployedAt,\n  setPositionInstruction,/);
  assert.match(dlmmSrc, /ensureDeployedAt\(positionAddress, \{ pool: pool\.poolAddress, pool_name: `\$\{pool\.tokenX\}-\$\{pool\.tokenY\}` \}\);/);
  assert.match(dlmmSrc, /peak_pnl_pct: tracked\.peak_pnl_pct \?\? null, \/\/ pack-side paper\/live shape fidelity/);
});

const dataDir = await mkdtemp(join(tmpdir(), "zenpack-79-state-"));
const oldDataDir = process.env.MERIDIAN_DATA_DIR;
const oldConfigPath = process.env.MERIDIAN_CONFIG_PATH;
process.env.MERIDIAN_DATA_DIR = dataDir;
process.env.MERIDIAN_CONFIG_PATH = join(dataDir, "user-config.json");
await writeFile(join(dataDir, "user-config.json"), JSON.stringify({ activeSetup: "recon-79", profile: "safe", dryRun: true }));

try {
  const { config } = await import(pathToFileURL(join(target, "config.js")).href);
  // Plugin 50 normally stamps these during boot; this isolated state harness sets
  // the same live config fields directly without loading the full plugin tree.
  config.activeSetup = "recon-79";
  config.profile = "safe";
  const state = await import(`${pathToFileURL(join(target, "state.js")).href}?stage79=${Date.now()}`);
  const statePath = join(dataDir, "state.json");
  const fields = {
    position: "paper_state_79",
    pool: "Pool79",
    pool_name: "TEST-SOL",
    strategy: "spot",
    bin_range: { min: 90, max: 100, active: 100 },
    active_bin: 100,
    bin_step: 100,
    amount_sol: 0.5,
  };

  await t("record shape + identity + deployed_at dibuat", async () => {
    state.trackPosition(fields);
    const p = state.getTrackedPosition(fields.position);
    assert.ok(p.deployed_at);
    assert.strictEqual(p.active_setup, "recon-79");
    assert.strictEqual(p.profile, "safe");
    assert.strictEqual(p.trough_pnl_pct, 0);
    assert.strictEqual(p.price_peak_pct, 0);
    assert.strictEqual(p.price_trough_pct, 0);
    for (const key of ["pending_peak_confirm_count", "pending_exit_action", "pending_exit_count"]) assert.ok(key in p);
    for (const key of ["pending_trailing_current_pnl_pct", "confirmed_trailing_exit_until"]) assert.ok(!(key in p));
  });

  await t("deployed_at tidak pernah reset saat re-track", async () => {
    const raw = JSON.parse(await readFile(statePath, "utf8"));
    raw.positions[fields.position].deployed_at = "2025-01-02T03:04:05.000Z";
    await writeFile(statePath, JSON.stringify(raw, null, 2));
    state.trackPosition({ ...fields, pool_name: "RETRACK-SOL" });
    assert.strictEqual(state.getTrackedPosition(fields.position).deployed_at, "2025-01-02T03:04:05.000Z");
  });

  await t("trough/price excursion terisi; suspicious hanya membekukan trough", () => {
    const mgmt = {
      trailingTakeProfit: false, stopLossPct: -50, trailingDropPct: 5,
      outOfRangeWaitMinutes: 9999, minFeePerTvl24h: null,
    };
    state.updatePnlAndCheckExits(fields.position, {
      pnl_pct: -5, pnl_pct_suspicious: false, in_range: true,
      active_bin: 102, fee_per_tvl_24h: 10, age_minutes: 1,
    }, mgmt);
    let p = state.getTrackedPosition(fields.position);
    assert.strictEqual(p.trough_pnl_pct, -5);
    assert.strictEqual(p.price_peak_pct, 2.01);

    state.updatePnlAndCheckExits(fields.position, {
      pnl_pct: -99, pnl_pct_suspicious: true, in_range: true,
      active_bin: 98, fee_per_tvl_24h: 10, age_minutes: 1,
    }, mgmt);
    p = state.getTrackedPosition(fields.position);
    assert.strictEqual(p.trough_pnl_pct, -5);
    assert.ok(p.price_trough_pct < 0);
  });

  await t("2-tick behavior persis: tick1 tidak fire, tick2 fire", () => {
    assert.strictEqual(state.confirmPeak(fields.position, 6, 2), false);
    assert.strictEqual(state.confirmPeak(fields.position, 6, 2), true);
    assert.strictEqual(state.getTrackedPosition(fields.position).peak_pnl_pct, 6);
    assert.deepStrictEqual(state.registerExitSignal(fields.position, "STOP_LOSS", 2), { fire: false, action: "STOP_LOSS", count: 1 });
    assert.deepStrictEqual(state.registerExitSignal(fields.position, "STOP_LOSS", 2), { fire: true, action: "STOP_LOSS", count: 2 });
  });

  await t("ensureDeployedAt backfill known + untracked idempotent", async () => {
    const raw = JSON.parse(await readFile(statePath, "utf8"));
    raw.positions[fields.position].deployed_at = null;
    await writeFile(statePath, JSON.stringify(raw, null, 2));
    state.ensureDeployedAt(fields.position);
    assert.ok(state.getTrackedPosition(fields.position).deployed_at);

    state.ensureDeployedAt("OnChainUntracked79", { pool: "PoolU", pool_name: "U-SOL" });
    const first = state.getTrackedPosition("OnChainUntracked79");
    assert.ok(first.deployed_at);
    assert.strictEqual(first.strategy, "unknown");
    assert.ok(first.notes.includes("Backfilled from on-chain — deploy metadata unknown"));
    state.ensureDeployedAt("OnChainUntracked79", { pool: "Changed" });
    const second = state.getTrackedPosition("OnChainUntracked79");
    assert.strictEqual(second.deployed_at, first.deployed_at);
    assert.strictEqual(second.pool, "PoolU");
  });
} finally {
  if (oldDataDir === undefined) delete process.env.MERIDIAN_DATA_DIR; else process.env.MERIDIAN_DATA_DIR = oldDataDir;
  if (oldConfigPath === undefined) delete process.env.MERIDIAN_CONFIG_PATH; else process.env.MERIDIAN_CONFIG_PATH = oldConfigPath;
  await rm(dataDir, { recursive: true, force: true });
}

console.log(`\nexit-state: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
