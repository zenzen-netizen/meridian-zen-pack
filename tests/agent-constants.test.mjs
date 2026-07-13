// Gerbang 5.3: patch 10 penyamaan konstanta role/intent agent.js.
//   node tests/agent-constants.test.mjs <path-target>
// Konstanta agent.js TIDAK di-export (module-local const) → diuji via REGEX-EXTRACT
// string file (bukan import — import agent.js memicu side-effect modul berat &
// konstanta tak terjangkau). Fungsional 2 profile-tool via executor (jalur 04b).
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/agent-constants.test.mjs <path-target>"); process.exit(1); }
process.chdir(target);

const src = readFileSync(join(target, "agent.js"), "utf8");

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

// Extract regex literal utk 1 intent dari INTENT_PATTERNS (1 baris per entri).
function intentRe(name) {
  const m = src.match(new RegExp(`intent: "${name}",\\s*re: (/.*/[a-z]*) }`));
  assert.ok(m, `intent "${name}" tak ketemu`);
  return eval(m[1]); // input dari file kita sendiri (terkontrol)
}

await t("SCREENER_TOOLS memuat 2 profile-tool (tutup utang exposure)", () => {
  const m = src.match(/const SCREENER_TOOLS = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, "SCREENER_TOOLS block tak ketemu");
  const body = m[1];
  assert.ok(body.includes('"get_time_profile"'), "get_time_profile absen");
  assert.ok(body.includes('"get_narrative_profile"'), "get_narrative_profile absen");
});

await t("SCREENER_TOOLS TIDAK memuat 6 tool pre-loaded (slim fork)", () => {
  const m = src.match(/const SCREENER_TOOLS = new Set\(\[([\s\S]*?)\]\)/);
  const body = m[1];
  for (const gone of ["get_active_bin", "check_smart_wallets_on_pool", "get_token_holders", "get_token_narrative", "get_token_info", "get_pool_memory"]) {
    assert.ok(!body.includes(`"${gone}"`), `${gone} harusnya sudah dibuang`);
  }
});

await t("intent bilingual: decisions match 'kenapa kamu skip'", () => {
  assert.ok(intentRe("decisions").test("kenapa kamu skip"));
});

await t("intent bilingual: close match 'tutup posisi'", () => {
  assert.ok(intentRe("close").test("tutup posisi"));
});

await t("intent bilingual: balance match 'saldo'", () => {
  assert.ok(intentRe("balance").test("saldo"));
});

await t("intent EN masih jalan: decisions match 'why did you skip'", () => {
  assert.ok(intentRe("decisions").test("why did you skip"));
});

// Fungsional: 2 profile-tool via executor (data kosong = graceful, bukan throw).
const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
const { executeTool } = await import(pathToFileURL(join(target, "tools/executor.js")).href);
await loadPlugins(join(target, "zenpack-plugins"), hooks);

await t("executeTool get_time_profile {} graceful (bukan throw)", async () => {
  const r = await executeTool("get_time_profile", {});
  assert.ok(!r?.error, `error: ${r?.error}`);
});

await t("executeTool get_narrative_profile {} graceful (bukan throw)", async () => {
  const r = await executeTool("get_narrative_profile", {});
  assert.ok(!r?.error, `error: ${r?.error}`);
});

console.log(`\nagent-constants: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
