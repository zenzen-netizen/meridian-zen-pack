// Gerbang 3.3: sandbox tanpa token Telegram -> invoke hook "telegram:command"
// langsung terhadap TARGET ter-install, assert handled + efek file nyata.
//   node tests/telegram-cmds.test.mjs <path-target>
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/telegram-cmds.test.mjs <path-target>"); process.exit(1); }
process.chdir(target); // path relatif profil/export dihitung dari repo target

const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
const res = await loadPlugins(join(target, "zenpack-plugins"), hooks);
console.log(`loader: loaded ${res.loaded.length}, skipped ${res.skipped.length}, errors ${res.errors.length}`);
for (const e of res.errors) console.error("  plugin error:", e.file, e.err);

async function fire(text) {
  const replies = [];
  const ctx = await hooks.run("telegram:command", { text, msg: { text }, reply: (t) => { replies.push(t); } });
  return { handled: !!ctx.handled, reply: replies.join("\n---\n") };
}

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

await t("/addprofil tanpa nama -> handled + usage", async () => {
  const r = await fire("/addprofil");
  assert.ok(r.handled); assert.ok(r.reply.includes("/addprofil <nama>"));
});

await t("/addprofil sandboxprofil -> handled + scaffold profiles/sandboxprofil/", async () => {
  const r = await fire("/addprofil sandboxprofil");
  assert.ok(r.handled);
  assert.ok(r.reply.includes("sandboxprofil"), "reply sebut nama");
  assert.ok(existsSync(join(target, "profiles/sandboxprofil")), "folder profil tercipta");
  console.log("     isi:", readdirSync(join(target, "profiles/sandboxprofil")).join(", "));
});

await t("/export profil -> handled + folder exports/", async () => {
  const r = await fire("/export profil");
  assert.ok(r.handled);
  assert.ok(existsSync(join(target, "exports")), "folder exports tercipta");
  console.log("     isi exports/:", readdirSync(join(target, "exports")).join(", "));
});

await t("/export racikan (kosong) -> handled + daftar kosong graceful (jalur 03a)", async () => {
  const r = await fire("/export racikan");
  assert.ok(r.handled);
  assert.ok(r.reply.includes("Belum ada racikan"), `reply: ${r.reply.slice(0, 120)}`);
});

await t("/status -> TIDAK handled (jatuh ke vanilla)", async () => {
  const r = await fire("/status");
  assert.strictEqual(r.handled, false);
});

console.log(`\nTELEGRAM-CMDS: ${pass}/${pass + fail} lolos`);
process.exit(fail ? 1 : 0);
