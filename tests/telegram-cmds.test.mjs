// Gerbang 3.3 + 3.4: sandbox tanpa token Telegram -> invoke hook "telegram:command"
// langsung terhadap TARGET ter-install, assert handled + efek file nyata.
//   node tests/telegram-cmds.test.mjs <path-target>
// Vanilla/uninstalled mode:
//   node tests/telegram-cmds.test.mjs <path-target> vanilla
// CATATAN: /preset save/use MENULIS user-config.json (stamp activeSetup);
// test ini backup/restore sendiri supaya suite idempotent.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import assert from "node:assert";

const target = process.argv[2];
const mode = process.argv[3] || "installed";
if (!target) { console.error("pakai: node tests/telegram-cmds.test.mjs <path-target> [vanilla]"); process.exit(1); }

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

if (mode === "vanilla") {
  const index = readFileSync(join(target, "index.js"), "utf8");
  await t("uninstall restores vanilla command branches", () => {
    assert.ok(index.includes('if (text === "/help")'));
    assert.ok(index.includes('if (text === "/pause")'));
    assert.ok(index.includes('if (text === "/resume")'));
    assert.ok(!index.includes("Stage 7.4 slim"));
  });
  console.log(`\nTELEGRAM-CMDS(${mode}): ${pass}/${pass + fail} lolos`);
  process.exit(fail ? 1 : 0);
}

process.chdir(target); // path relatif profil/export dihitung dari repo target

const userConfigPath = join(target, "user-config.json");
const hadUserConfig = existsSync(userConfigPath);
const originalUserConfig = hadUserConfig ? readFileSync(userConfigPath) : null;
const solHistoryPath = join(target, "data/sol-balance-history.json");
const hadSolHistory = existsSync(solHistoryPath);
const originalSolHistory = hadSolHistory ? readFileSync(solHistoryPath) : null;
const presetArtifacts = ["presets/sandboxset.json", "presets/_backup.json"].map((rel) => {
  const path = join(target, rel);
  return { path, had: existsSync(path), data: existsSync(path) ? readFileSync(path) : null };
});
function restoreUserConfig() {
  if (hadUserConfig) writeFileSync(userConfigPath, originalUserConfig);
  else rmSync(userConfigPath, { force: true });
  if (hadSolHistory) {
    mkdirSync(join(target, "data"), { recursive: true });
    writeFileSync(solHistoryPath, originalSolHistory);
  } else {
    rmSync(solHistoryPath, { force: true });
  }
  for (const item of presetArtifacts) {
    if (item.had) writeFileSync(item.path, item.data);
    else rmSync(item.path, { force: true });
  }
}
for (const item of presetArtifacts) rmSync(item.path, { force: true });
process.on("exit", restoreUserConfig);

const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
const res = await loadPlugins(join(target, "zenpack-plugins"), hooks);
console.log(`loader: loaded ${res.loaded.length}, skipped ${res.skipped.length}, errors ${res.errors.length}`);
for (const e of res.errors) console.error("  plugin error:", e.file, e.err);
const moneyPlugin = await import(pathToFileURL(join(target, "zenpack-plugins/70-money-commands.js")).href);
moneyPlugin.__test.setRuntime({ getTopCandidates: async () => ({ candidates: [] }) });

async function fire(text) {
  const replies = [];
  const ctx = await hooks.run("telegram:command", { text, msg: { text }, reply: (t) => { replies.push(t); } });
  return { handled: !!ctx.handled, reply: replies.join("\n---\n") };
}

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

// Stage 3.6: /status di-intercept plugin 30-render-views (views HTML).
await t("/status -> handled oleh 30-render-views (views HTML)", async () => {
  const r = await fire("/status");
  assert.strictEqual(r.handled, true);
});
// Stage 3.7 batch 2: /wallet /config /pool kini di-intercept juga.
await t("/wallet -> handled oleh 30-render-views (batch 2)", async () => {
  const r = await fire("/wallet");
  assert.strictEqual(r.handled, true);
});
await t("/config -> handled oleh 30-render-views (batch 2)", async () => {
  const r = await fire("/config");
  assert.strictEqual(r.handled, true);
});
await t("/config core -> handled (sub-cmd plugin-additive)", async () => {
  const r = await fire("/config core");
  assert.strictEqual(r.handled, true);
});
await t("/config origin -> handled (sub-cmd plugin-additive)", async () => {
  const r = await fire("/config origin");
  assert.strictEqual(r.handled, true);
});
await t("/pool 1 -> handled (no positions -> Invalid number, graceful)", async () => {
  const r = await fire("/pool 1");
  assert.strictEqual(r.handled, true);
});
// Stage 7.2: /settings di-intercept plugin 60-settings-menu.
await t("/settings -> handled oleh 60-settings-menu", async () => {
  const r = await fire("/settings");
  assert.strictEqual(r.handled, true);
});
// Stage 7.4 slim: display/importable command branches.
await t("/help -> handled + systemView fork help", async () => {
  const r = await fire("/help");
  assert.strictEqual(r.handled, true);
  assert.ok(r.reply.includes("Meridian · Commands"), `reply: ${r.reply.slice(0, 160)}`);
  assert.ok(r.reply.includes("/report"), "fork help includes /report");
  assert.ok(r.reply.includes("/guide"), "fork help includes /guide");
});
await t("/guide -> handled + renderGuide TOC", async () => {
  const r = await fire("/guide");
  assert.strictEqual(r.handled, true);
  assert.ok(r.reply.includes("Panduan"), `reply: ${r.reply.slice(0, 160)}`);
});
await t("/wallet trackstart set/show/off -> handled + sol history restored on exit", async () => {
  let r = await fire("/wallet trackstart 2026-01-01");
  assert.strictEqual(r.handled, true);
  assert.ok(r.reply.includes("diset ke 2026-01-01"), `reply: ${r.reply.slice(0, 160)}`);
  r = await fire("/wallet trackstart");
  assert.strictEqual(r.handled, true);
  assert.ok(r.reply.includes("2026-01-01"), `reply: ${r.reply.slice(0, 160)}`);
  r = await fire("/wallet trackstart off");
  assert.strictEqual(r.handled, true);
  assert.ok(r.reply.includes("anchor dihapus"), `reply: ${r.reply.slice(0, 160)}`);
});
await t("/hive -> handled + renderHive", async () => {
  const r = await fire("/hive");
  assert.strictEqual(r.handled, true);
  assert.ok(r.reply.includes("HiveMind"), `reply: ${r.reply.slice(0, 160)}`);
  assert.ok(r.reply.includes("Agent ID"), "renderHive includes agent id");
});
// /config bogus (bukan core|origin) TETAP jatuh ke vanilla (tak match 3 bentuk eksak).
await t("/config bogus -> TIDAK handled (jatuh ke vanilla)", async () => {
  const r = await fire("/config bogus");
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

await t("/screen -> handled plugin 70 (override keputusan 7.4)", async () => {
  const r = await fire("/screen");
  assert.strictEqual(r.handled, true);
});
await t("/pause -> TIDAK handled (accepted display delta; vanilla)", async () => {
  const r = await fire("/pause");
  assert.strictEqual(r.handled, false);
});
await t("/resume -> TIDAK handled (accepted display delta; vanilla)", async () => {
  const r = await fire("/resume");
  assert.strictEqual(r.handled, false);
});
await t("/report -> TIDAK handled (defer 7.7)", async () => {
  const r = await fire("/report");
  assert.strictEqual(r.handled, false);
});

// Bukti "TIDAK exit": proses masih hidup sampai sini (finishPresetApply non-pm2
// tidak memanggil process.exit) — kalau exit, baris ringkasan di bawah tak tercetak.

console.log(`\nTELEGRAM-CMDS: ${pass}/${pass + fail} lolos`);
process.exit(fail ? 1 : 0);
