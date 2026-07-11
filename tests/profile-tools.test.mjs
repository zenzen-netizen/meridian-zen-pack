// Gerbang 3.5: tool LLM custom get_time_profile + get_narrative_profile terhadap
// TARGET ter-install (money-adjacent: executor.js — tes ekstra regresi toolMap).
//   node tests/profile-tools.test.mjs <path-target>
// Semua jalur read-only: profil kosong graceful, tanpa network (regresi pakai
// list_strategies + get_recent_decisions = baca file lokal saja).
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/profile-tools.test.mjs <path-target>"); process.exit(1); }
process.chdir(target); // .env dummy + path data relatif dihitung dari repo target

const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
const { executeTool } = await import(pathToFileURL(join(target, "tools/executor.js")).href);
const { tools } = await import(pathToFileURL(join(target, "tools/definitions.js")).href);

const toolNames = () => tools.map((t) => t.function.name);
const before = { tools: toolNames() };

const res = await loadPlugins(join(target, "zenpack-plugins"), hooks);
console.log(`loader: loaded ${res.loaded.length}, skipped ${res.skipped.length}, errors ${res.errors.length}`);
for (const e of res.errors) console.error("  plugin error:", e.file, e.err);

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

await t("loader: 4 plugin loaded, 0 skipped, 0 errors", async () => {
  assert.strictEqual(res.loaded.length, 4);
  assert.strictEqual(res.skipped.length, 0);
  assert.strictEqual(res.errors.length, 0);
});

await t("pra-registrasi: 2 tool baru BELUM ada di tools (bukti registrasi runtime, bukan module-load)", async () => {
  assert.ok(!before.tools.includes("get_time_profile"));
  assert.ok(!before.tools.includes("get_narrative_profile"));
});

await t("executeTool get_time_profile {} -> hasil valid + graceful data kosong", async () => {
  const r = await executeTool("get_time_profile", {});
  assert.ok(!r?.error, `error: ${r?.error}`);
  assert.strictEqual(r.timezone, "WIB (UTC+7)");
  assert.ok(Array.isArray(r.sessions) && r.sessions.length === 5, "5 sesi WIB");
  assert.ok(Number.isFinite(r.total_with_open_time), "total_with_open_time angka");
});

await t("executeTool get_narrative_profile {} -> hasil valid + graceful data kosong", async () => {
  const r = await executeTool("get_narrative_profile", {});
  assert.ok(!r?.error, `error: ${r?.error}`);
  assert.strictEqual(r.min_samples, 8);
  assert.ok(Array.isArray(r.categories), "categories array");
  assert.ok(Number.isFinite(r.total_with_category), "total_with_category angka");
});

await t("tools runtime memuat 2 schema baru (jalur agent: agent.js filter array tools per-panggilan)", async () => {
  const names = toolNames();
  assert.ok(names.includes("get_time_profile"));
  assert.ok(names.includes("get_narrative_profile"));
  assert.strictEqual(names.length, before.tools.length + 2);
});

await t("schema baru lewat mirror transform (additionalProperties false, parameters object)", async () => {
  const def = tools.find((t) => t.function.name === "get_time_profile");
  assert.strictEqual(def.function.parameters.additionalProperties, false);
  assert.strictEqual(def.function.parameters.type, "object");
});

await t("regresi vanilla: list_strategies masih resolve + jalan (read-only)", async () => {
  const r = await executeTool("list_strategies", {});
  assert.ok(!r?.error, `error: ${r?.error}`);
});

await t("regresi vanilla: get_recent_decisions masih resolve + jalan (read-only)", async () => {
  const r = await executeTool("get_recent_decisions", {});
  assert.ok(!r?.error, `error: ${r?.error}`);
  assert.ok(Array.isArray(r.decisions), "decisions array");
});

await t("paritas fork: kunci statis toolMap vanilla + 2 runtime = 47 (fork)", async () => {
  const countKeys = (src) => {
    const lines = src.split("\n");
    let inMap = false, c = 0;
    for (const l of lines) {
      if (/^const toolMap = \{/.test(l)) { inMap = true; continue; }
      if (inMap && /^\};/.test(l)) break;
      if (inMap && /^  [A-Za-z_][A-Za-z0-9_]*:/.test(l)) c++;
    }
    return c;
  };
  const vanillaStatic = countKeys(readFileSync(join(target, "tools/executor.js"), "utf8"));
  assert.strictEqual(vanillaStatic, 45, `kunci statis vanilla = ${vanillaStatic}`);
  assert.strictEqual(vanillaStatic + 2, 47, "45 lama + 2 baru = 47, cocok fork");
});

await t("tool tak dikenal tetap ditolak (executeTool guard utuh)", async () => {
  const r = await executeTool("zenpack_bogus_tool", {});
  assert.ok(String(r?.error || "").includes("Unknown tool"), `dapat: ${JSON.stringify(r).slice(0, 80)}`);
});

console.log(`\nprofile-tools: ${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
