// Gerbang 3.3 + 3.4: sandbox tanpa token Telegram -> invoke hook "telegram:command"
// langsung terhadap TARGET ter-install, assert handled + efek file nyata.
//   node tests/telegram-cmds.test.mjs <path-target>
// CATATAN: /preset save/use MENULIS user-config.json (stamp activeSetup) —
// caller wajib backup/restore user-config.json di sekitar run (lihat gerbang bash).
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

// ─── Gerbang 3.4: /preset family ──────────────────────────────────
await t("/preset (list kosong) -> handled + graceful", async () => {
  const r = await fire("/preset");
  assert.ok(r.handled);
  assert.ok(r.reply.includes("Belum ada racikan"), `reply: ${r.reply.slice(0, 120)}`);
});

await t("/preset save sandboxset -> handled + presets/sandboxset.json tercipta", async () => {
  const r = await fire("/preset save sandboxset");
  assert.ok(r.handled);
  assert.ok(r.reply.includes('preset "sandboxset"'), `reply: ${r.reply.slice(0, 120)}`);
  assert.ok(existsSync(join(target, "presets/sandboxset.json")), "file preset tercipta");
});

await t('/preset show sandboxset -> handled + "identik dengan config saat ini"', async () => {
  const r = await fire("/preset show sandboxset");
  assert.ok(r.handled);
  assert.ok(r.reply.includes("identik dengan config saat ini"), `reply: ${r.reply.slice(0, 120)}`);
});

await t("/preset use sandboxset -> handled + _backup tercipta + instruksi restart manual (non-pm2, TIDAK exit)", async () => {
  const r = await fire("/preset use sandboxset");
  assert.ok(r.handled);
  assert.ok(r.reply.includes('Preset "sandboxset" di-load'), `reply: ${r.reply.slice(0, 160)}`);
  assert.ok(existsSync(join(target, "presets/_backup.json")), "backup _backup.json tercipta");
  assert.ok(r.reply.includes("Restart proses untuk apply penuh"), "jalur non-pm2: instruksi restart manual");
  assert.ok(r.reply.includes("pm2 restart meridian"), "reply sebut contoh pm2 restart");
});

await t("/preset rm sandboxset -> handled + terhapus", async () => {
  const r = await fire("/preset rm sandboxset");
  assert.ok(r.handled);
  assert.ok(r.reply.includes("dihapus"), `reply: ${r.reply.slice(0, 120)}`);
  assert.ok(!existsSync(join(target, "presets/sandboxset.json")), "file preset terhapus");
});

await t("/preset xyz (sub tak dikenal) -> handled + usage", async () => {
  const r = await fire("/preset xyz");
  assert.ok(r.handled);
  assert.ok(r.reply.includes("/preset save <nama>"), `reply: ${r.reply.slice(0, 120)}`);
});

await t("/screen -> TIDAK handled (jatuh ke vanilla)", async () => {
  const r = await fire("/screen");
  assert.strictEqual(r.handled, false);
});

// Bukti "TIDAK exit": proses masih hidup sampai sini (finishPresetApply non-pm2
// tidak memanggil process.exit) — kalau exit, baris ringkasan di bawah tak tercetak.

console.log(`\nTELEGRAM-CMDS: ${pass}/${pass + fail} lolos`);
process.exit(fail ? 1 : 0);
