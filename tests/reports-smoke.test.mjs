// Smoke reports.js terhadap target ter-install; read-only, tanpa angka live.
import assert from "node:assert";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const target = process.argv[2];
if (!target) throw new Error("pakai: node tests/reports-smoke.test.mjs <path-target>");

const reports = await import(pathToFileURL(join(target, "reports.js")).href);
for (const name of ["computeTradeStats", "buildTradeReport", "estimateGasSol"]) {
  assert.strictEqual(typeof reports[name], "function", `${name} export`);
}
assert.deepStrictEqual(reports.computeTradeStats([]), { count: 0 });
assert.ok(reports.estimateGasSol({ close_position: 1 }) > 0);
const pnl = await import(pathToFileURL(join(target, "pnl-tracker.js")).href);
const block = pnl.formatPnlTracker([{ pnl_usd: 2, recorded_at: new Date().toISOString() }]);
assert.ok(block.includes("Realized PnL & Net"));
const renderPlugin = readFileSync(join(target, "zenpack-plugins/30-render-views.js"), "utf8");
assert.strictEqual(renderPlugin.split("pnlBlock: formatPnlTracker(getModePerformance()").length - 1, 2);
console.log("reports-smoke: module + /status,/wallet Realized chain PASS");
