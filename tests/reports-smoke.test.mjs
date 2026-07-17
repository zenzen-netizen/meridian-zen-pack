// Smoke reports.js terhadap target ter-install; read-only, tanpa angka live.
import assert from "node:assert";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) throw new Error("pakai: node tests/reports-smoke.test.mjs <path-target>");

const reports = await import(pathToFileURL(join(target, "reports.js")).href);
for (const name of ["computeTradeStats", "buildTradeReport", "estimateGasSol"]) {
  assert.strictEqual(typeof reports[name], "function", `${name} export`);
}
assert.deepStrictEqual(reports.computeTradeStats([]), { count: 0 });
assert.ok(reports.estimateGasSol({ close_position: 1 }) > 0);
console.log("reports-smoke: module loaded, exports live, empty dataset safe");
