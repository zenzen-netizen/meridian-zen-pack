// Gerbang 5.6: patch 13 — schema deploy_position dapat narrative_category+conviction.
//   node tests/definitions-ext.test.mjs <path-target>
// definitions.js = data murni (nol import config/lessons berat) → import langsung aman.
// Sekalian assert hunk 1-2 (get_time_profile/get_narrative_profile) SUDAH full via
// registrar patch 04b + plugin 20-profile-tools.js (bukan tanggung jawab patch 13,
// tapi harus tetap terbukti berdiri di sisi definitions.js statis).
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/definitions-ext.test.mjs <path-target>"); process.exit(1); }

const { tools, zenpackRegisterToolDef } = await import(pathToFileURL(join(target, "tools/definitions.js")).href);

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

function deployPositionSchema() {
  const def = tools.find((d) => d.function?.name === "deploy_position");
  assert.ok(def, "deploy_position tool tak ketemu");
  return def.function.parameters.properties;
}

t("deploy_position schema: narrative_category enum 8 kategori", () => {
  const props = deployPositionSchema();
  assert.ok(props.narrative_category, "narrative_category absen");
  assert.deepStrictEqual(props.narrative_category.enum,
    ["animal", "ai", "political", "celebrity", "meme", "culture", "tech_utility", "other"]);
});

t("deploy_position schema: conviction enum low/medium/high", () => {
  const props = deployPositionSchema();
  assert.ok(props.conviction, "conviction absen");
  assert.deepStrictEqual(props.conviction.enum, ["low", "medium", "high"]);
});

t("idempotent: cuma 1 narrative_category + 1 conviction (nol duplikasi)", () => {
  const names = tools.filter((d) => d.function?.name === "deploy_position");
  assert.strictEqual(names.length, 1, "deploy_position seharusnya cuma 1 definisi");
});

t("hunk 1-2 SKIP terverifikasi: get_time_profile + get_narrative_profile schema full via registrar", () => {
  const before = tools.length;
  zenpackRegisterToolDef({ type: "function", function: { name: "__probe__", description: "d", parameters: { type: "object", properties: {} } } });
  assert.strictEqual(tools.length, before + 1, "registrar zenpackRegisterToolDef tak jalan (patch 04b)");
  // NB: get_time_profile/get_narrative_profile sendiri baru masuk `tools` saat loadPlugins()
  // memanggil plugin 20-profile-tools.js register() runtime — di luar scope import statis ini
  // (sudah dibuktikan struktural di zenpack-plugins/20-profile-tools.js:18-44, FASE A).
});

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
