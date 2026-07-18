// Gerbang 5.4: patch 11 agentLoop blok 1 (fallbackClient) + blok 2 (salvage).
//   node tests/agentloop-ext.test.mjs <path-target>
// Konstanta/fungsi agent.js TIDAK di-export (module-local) → blok 1 diuji STRUKTURAL
// (string file); blok 2 parseContentToolCalls + salvage-guard diuji FUNGSIONAL via
// eval sumber fungsi dgn VALID_TOOL_NAMES/jsonrepair terkontrol (input dari file kita
// sendiri). Properti keamanan inti: mutating tool-dump (deploy/close/claim/swap) TIDAK
// pernah di-salvage jadi tool call.
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/agentloop-ext.test.mjs <path-target>"); process.exit(1); }
const src = readFileSync(join(target, "agent.js"), "utf8");

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

// ── BLOK 1 fallbackClient (struktural) ──────────────────────────────────────
await t("blok 1a: fallbackClient decl fail-open (env absen = null)", () => {
  const m = src.match(/const fallbackClient = process\.env\.LLM_FALLBACK_BASE_URL[\s\S]*?: null;/);
  assert.ok(m, "decl fallbackClient tak ketemu");
  assert.ok(m[0].includes("new OpenAI("), "cabang enable (new OpenAI) absen");
  assert.ok(/:\s*null;/.test(m[0]), "cabang fail-open (: null) absen");
});

await t("blok 1b: routing activeClient = useFallbackForModel ? fallbackClient : client", () => {
  assert.ok(/const useFallbackForModel = fallbackClient && model && model\.endsWith\("-free"\);/.test(src), "useFallbackForModel absen");
  assert.ok(/let activeClient = useFallbackForModel \? fallbackClient : client;/.test(src), "activeClient ternary absen");
});

await t("blok 1c: request pakai activeClient (bukan client langsung)", () => {
  assert.ok(/response = await activeClient\.chat\.completions\.create\(reqParams\);/.test(src), "activeClient.create absen");
  assert.ok(!/response = await client\.chat\.completions\.create/.test(src), "masih ada client.create lama");
});

await t("blok 1d: failover elif ke fallbackClient dalam error-block", () => {
  assert.ok(/if \(attempt === 1 && fallbackClient && activeClient !== fallbackClient\) \{/.test(src), "failover if absen");
  assert.ok(/activeClient = fallbackClient;/.test(src), "reassign activeClient absen");
  assert.ok(/\} else if \(attempt === 1 && usedModel !== FALLBACK_MODEL\) \{/.test(src), "elif model-fallback lama harus jadi else-if");
});

// ── BLOK 3-6: patch 29 ─────────────────────────────────────────────────────
await t("blok 3 dedup: satu Promise per signature dan fan-out per tool_call_id", () => {
  assert.ok(src.includes("const runToolCall = async (toolCall) =>"));
  assert.ok(src.includes("const execCache = new Map()"));
  assert.ok(src.includes("if (!execCache.has(signature)) execCache.set(signature, runToolCall(toolCall));"));
  assert.ok(src.includes("content: await execCache.get(signature)"));
  assert.ok(!src.includes("invalidToolArgErrors"), "map arg-error lama harus hilang bersama refactor fork");
});

await t("blok 4 confirm default inert dan hanya menjaga 5 tool mutasi", () => {
  assert.ok(src.includes("onConfirmRequired = null"));
  assert.ok(src.includes("if (interactive && onConfirmRequired && CHAT_CONFIRM_TOOLS.has(functionName))"));
  const set = src.match(/const CHAT_CONFIRM_TOOLS = new Set\(\[([^\]]+)\]\)/)?.[1] || "";
  for (const name of ["update_config", "deploy_position", "close_position", "claim_fees", "swap_token"]) {
    assert.ok(set.includes(`"${name}"`), `${name} absen dari confirm set`);
  }
});

await t("blok 5 cost always-on fail-open", () => {
  assert.ok(src.includes('import { recordLlmCost } from "./llm-cost-tracker.js";'));
  assert.ok(src.includes("usage: { include: true }"));
  assert.ok(/try \{\s*const u = response\?\.usage;[\s\S]*recordLlmCost/.test(src));
  assert.ok(src.includes("} catch { /* never break the call */ }"));
});

await t("blok 6 option defaults inert; baseline GENERAL 8192 delta eksplisit", () => {
  assert.ok(src.includes("allowNoToolFinal = false"));
  assert.ok(src.includes("if (mustUseRealTool && !sawToolCall && !allowNoToolFinal)"));
  assert.ok(src.includes('content: allowNoToolFinal'));
  assert.ok(src.includes('max_tokens: maxOutputTokens ?? (agentType === "GENERAL" ? config.llm.generalMaxTokens : config.llm.maxTokens)'));
});

// ── BLOK 2 salvage (fungsional) ─────────────────────────────────────────────
// Eval sumber fungsi + Set konstanta dgn dependensi terkontrol.
const require = createRequire(join(target, "package.json"));
const { jsonrepair } = require("jsonrepair"); // dari node_modules target

// Set yg dipakai salvage-guard: rekonstruksi dari string file (verbatim decl).
function extractSet(name) {
  const m = src.match(new RegExp(`const ${name} = new Set\\(([\\s\\S]*?)\\);`));
  assert.ok(m, `${name} decl tak ketemu`);
  // eval literal array/spread — input file kita sendiri (terkontrol).
  return m[0];
}
const VALID = ["get_my_positions", "get_top_candidates", "deploy_position", "close_position", "claim_fees", "swap_token", "self_update", "update_config"];
const fnSrc = src.match(/function parseContentToolCalls\(content\) \{[\s\S]*?\n\}/);
assert.ok(fnSrc, "parseContentToolCalls fn tak ketemu");

const sandbox = new Function("jsonrepair", "VALID_TOOL_NAMES", `
  ${extractSet("GENERAL_INTENT_ONLY_TOOLS")}
  ${extractSet("ONCHAIN_WRITE_TOOLS")}
  ${extractSet("NO_SALVAGE_TOOLS")}
  ${fnSrc[0]}
  return { parseContentToolCalls, NO_SALVAGE_TOOLS };
`)(jsonrepair, new Set(VALID));
const { parseContentToolCalls, NO_SALVAGE_TOOLS } = sandbox;

// Replika keputusan salvage di loop (agent.js): salvage HANYA kalau tak ada tool NO_SALVAGE.
const salvageable = (dumped) => !!dumped && !dumped.some((c) => NO_SALVAGE_TOOLS.has(c.name));

await t("parse: prosa biasa (bukan JSON) → null (bukan dump)", () => {
  assert.strictEqual(parseContentToolCalls("Saya sudah cek, tidak ada kandidat bagus."), null);
});

await t("parse: read-only dump dikenali", () => {
  const d = parseContentToolCalls('[{"name":"get_my_positions","parameters":{}}]');
  assert.ok(Array.isArray(d) && d.length === 1 && d[0].name === "get_my_positions");
});

await t("parse: dump dalam code-fence markdown dikenali", () => {
  const d = parseContentToolCalls('```json\n[{"name":"get_top_candidates","parameters":{"limit":3}}]\n```');
  assert.ok(Array.isArray(d) && d[0].name === "get_top_candidates");
});

await t("KEAMANAN: read-only dump → SALVAGEABLE (jadi tool call)", () => {
  const d = parseContentToolCalls('[{"name":"get_top_candidates","parameters":{"limit":3}}]');
  assert.strictEqual(salvageable(d), true);
});

await t("KEAMANAN: deploy_position dump → DITOLAK (tak di-salvage, tak dieksekusi)", () => {
  const d = parseContentToolCalls('[{"name":"deploy_position","parameters":{"pool_address":"X","amount_y":0.5}}]');
  assert.ok(d, "parse mengenali dump");
  assert.strictEqual(salvageable(d), false, "MUTATING dump WAJIB tak boleh di-salvage");
});

await t("KEAMANAN: close_position dump → DITOLAK", () => {
  const d = parseContentToolCalls('[{"name":"close_position","parameters":{}}]');
  assert.strictEqual(salvageable(d), false);
});

await t("KEAMANAN: campuran read-only + swap_token → DITOLAK seluruhnya", () => {
  const d = parseContentToolCalls('[{"name":"get_my_positions"},{"name":"swap_token","parameters":{}}]');
  assert.strictEqual(salvageable(d), false);
});

await t("KEAMANAN: NO_SALVAGE_TOOLS mencakup 4 on-chain write + intent-only", () => {
  for (const w of ["deploy_position", "close_position", "claim_fees", "swap_token", "self_update", "update_config"]) {
    assert.ok(NO_SALVAGE_TOOLS.has(w), `${w} harus di NO_SALVAGE_TOOLS`);
  }
});

console.log(`\nagentloop-ext: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
