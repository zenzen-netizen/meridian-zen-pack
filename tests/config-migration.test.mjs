import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateLegacyGmgnConfig } from "../lib/config-migration.js";

const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
let pass = 0;

function fixture(name, user, gmgn) {
  const root = mkdtempSync(join(tmpdir(), `zenpack-pra8-${name}-`));
  mkdirSync(root, { recursive: true });
  const userConfigPath = join(root, "user-config.json");
  const gmgnConfigPath = join(root, "gmgn-config.json");
  if (user !== undefined) writeJson(userConfigPath, user);
  if (gmgn !== undefined) writeJson(gmgnConfigPath, gmgn);
  return { root, userConfigPath, gmgnConfigPath };
}

function t(name, fn) {
  fn();
  pass++;
  console.log("  ✅", name);
}

t("MAIN fixture: split config remains byte-identical", () => {
  const f = fixture("main", { minTvl: 10 }, { minTokenAgeHours: 2, _lastAgentTune: "old" });
  const beforeUser = readFileSync(f.userConfigPath);
  const beforeGmgn = readFileSync(f.gmgnConfigPath);
  const result = migrateLegacyGmgnConfig(f);
  assert.equal(result.changed, false);
  assert.deepEqual(readFileSync(f.userConfigPath), beforeUser);
  assert.deepEqual(readFileSync(f.gmgnConfigPath), beforeGmgn);
});

t("bot3 fixture: gmgnFeeSource maps to canonical feeSource", () => {
  const f = fixture("bot3", { gmgnFeeSource: "jupiter", minTvl: 10 });
  const sourceBytes = readFileSync(f.userConfigPath);
  const result = migrateLegacyGmgnConfig(f);
  assert.deepEqual(result.migrated, ["gmgnFeeSource"]);
  assert.equal(readJson(f.gmgnConfigPath).feeSource, "jupiter");
  assert.equal(Object.hasOwn(readJson(f.userConfigPath), "gmgnFeeSource"), false);
  assert.deepEqual(readFileSync(`${f.userConfigPath}.pre-zenpack-pra8.bak`), sourceBytes);
});

t("v3 fixture: no GMGN data is a no-op", () => {
  const f = fixture("v3", { minTvl: 10 });
  const before = readFileSync(f.userConfigPath);
  assert.equal(migrateLegacyGmgnConfig(f).changed, false);
  assert.deepEqual(readFileSync(f.userConfigPath), before);
});

t("canonical values win and nested rules migrate", () => {
  const f = fixture("conflict", {
    gmgnFeeSource: "jupiter",
    gmgnRequireBullishSt: false,
    gmgnMinRsi: 25,
  }, {
    feeSource: "gmgn",
    indicatorRules: { requireBullishSupertrend: true },
  });
  const oldGmgn = readFileSync(f.gmgnConfigPath);
  migrateLegacyGmgnConfig(f);
  const out = readJson(f.gmgnConfigPath);
  assert.equal(out.feeSource, "gmgn");
  assert.equal(out.indicatorRules.requireBullishSupertrend, true);
  assert.equal(out.indicatorRules.minRsi, 25);
  assert.deepEqual(readFileSync(`${f.gmgnConfigPath}.pre-zenpack-pra8.bak`), oldGmgn);
});

t("unknown GMGN names are preserved and reported", () => {
  const f = fixture("unknown", { gmgnDeadForkName: 7, gmgnFeeSource: "gmgn" });
  const result = migrateLegacyGmgnConfig(f);
  assert.deepEqual(result.preservedUnknown, ["gmgnDeadForkName"]);
  assert.equal(readJson(f.userConfigPath).gmgnDeadForkName, 7);
});

t("corrupt GMGN JSON fails closed before backup or write", () => {
  const f = fixture("corrupt", { gmgnFeeSource: "gmgn" });
  writeFileSync(f.gmgnConfigPath, "{broken\n");
  const userBefore = readFileSync(f.userConfigPath);
  const gmgnBefore = readFileSync(f.gmgnConfigPath);
  assert.throws(() => migrateLegacyGmgnConfig(f), /gmgn-config\.json tidak valid/);
  assert.deepEqual(readFileSync(f.userConfigPath), userBefore);
  assert.deepEqual(readFileSync(f.gmgnConfigPath), gmgnBefore);
});

t("second run is byte-idempotent and never overwrites backup", () => {
  const f = fixture("repeat", { gmgnApiKey: "secret", minTvl: 10 });
  migrateLegacyGmgnConfig(f);
  const userAfter = readFileSync(f.userConfigPath);
  const gmgnAfter = readFileSync(f.gmgnConfigPath);
  const backup = readFileSync(`${f.userConfigPath}.pre-zenpack-pra8.bak`);
  const second = migrateLegacyGmgnConfig(f);
  assert.equal(second.changed, false);
  assert.deepEqual(readFileSync(f.userConfigPath), userAfter);
  assert.deepEqual(readFileSync(f.gmgnConfigPath), gmgnAfter);
  assert.deepEqual(readFileSync(`${f.userConfigPath}.pre-zenpack-pra8.bak`), backup);
});

console.log(`\nCONFIG-MIGRATION: ${pass}/${pass} lolos`);
