// Stage 7.2: /settings plugin 60 + patch 28.
// Installed mode:
//   node tests/settings-menu.test.mjs <target>
// Vanilla/uninstalled mode:
//   node tests/settings-menu.test.mjs <target> vanilla
import assert from "node:assert";
import { existsSync, readFileSync, copyFileSync, mkdtempSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
const mode = process.argv[3] || "installed";
if (!target) { console.error("pakai: node tests/settings-menu.test.mjs <path-target> [vanilla]"); process.exit(1); }

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (e) { console.log("  ❌", name, "→", e.message); fail++; }
}

if (mode === "vanilla") {
  const index = readFileSync(join(target, "index.js"), "utf8");
  await t("uninstall restores vanilla /settings branch", () => {
    assert.ok(index.includes('if (text === "/settings" || text === "/menu" || text === "/configmenu")'));
    assert.ok(index.includes("async function showSettingsMenu"));
    assert.ok(!index.includes("zen-pack:28"));
    assert.ok(!index.includes("zen-pack:03b"));
  });
  console.log(`\nSETTINGS-MENU(${mode}): ${pass}/${pass + fail} lolos`);
  process.exit(fail ? 1 : 0);
}

process.chdir(target);
process.env.DRY_RUN ||= "true";
process.env.TELEGRAM_BOT_TOKEN ||= "test";
process.env.TELEGRAM_CHAT_ID ||= "123";
process.env.OPENROUTER_API_KEY ||= "dummy";
process.env.WALLET_PRIVATE_KEY ||= "11111111111111111111111111111111";
process.env.RPC_URL ||= "http://127.0.0.1:8899";

const files = ["user-config.json", "gmgn-config.json", "lessons.json"];
const tmp = mkdtempSync(join(tmpdir(), "zenpack-settings-"));
const states = files.map((file) => ({ file, had: existsSync(file), backup: join(tmp, file) }));
for (const s of states) if (s.had) copyFileSync(s.file, s.backup);
process.on("exit", () => {
  for (const s of states) {
    if (s.had) copyFileSync(s.backup, s.file);
    else if (existsSync(s.file)) unlinkSync(s.file);
  }
  rmSync(tmp, { recursive: true, force: true });
});

const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
  return { ok: true, json: async () => ({ ok: true }), text: async () => "" };
};

const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const { loadPlugins } = await import(pathToFileURL(join(target, "zenpack-lib/loader.js")).href);
const res = await loadPlugins(join(target, "zenpack-plugins"), hooks);
console.log(`loader: loaded ${res.loaded.length}, skipped ${res.skipped.length}, errors ${res.errors.length}`);
for (const e of res.errors) console.error("  plugin error:", e.file, e.err);
assert.strictEqual(res.errors.length, 0);

async function fire(text, extra = {}) {
  const ctx = await hooks.run("telegram:command", {
    text,
    msg: { text, ...extra },
    reply: () => {},
  });
  return ctx;
}

function takeCalls() {
  const out = calls.splice(0);
  return out.map((c) => ({ method: c.url.split("/").pop(), body: c.body }));
}

const readUserConfig = () => existsSync("user-config.json") ? JSON.parse(readFileSync("user-config.json", "utf8")) : {};
const readGmgnConfig = () => existsSync("gmgn-config.json") ? JSON.parse(readFileSync("gmgn-config.json", "utf8")) : {};

await t("/settings renders fn-landing", async () => {
  const ctx = await fire("/settings");
  const out = takeCalls();
  const send = out.find((c) => c.method === "sendMessage");
  assert.strictEqual(ctx.handled, true);
  assert.ok(send?.body?.text?.includes("⚙️ SETTINGS"), "settings header");
  assert.ok(send?.body?.text?.includes("Mode Campur"), "fn landing controls");
});

await t("toggle non-gmgn persists", async () => {
  const ctx = await fire("cfg:toggle:paperTrading", {
    isCallback: true,
    callbackData: "cfg:toggle:paperTrading",
    callbackQueryId: "cb-toggle",
    messageId: 10,
  });
  const out = takeCalls();
  const saved = readUserConfig();
  assert.strictEqual(ctx.handled, true);
  assert.ok(saved.paperTrading != null, "paperTrading persisted");
  assert.ok(out.some((c) => c.method === "answerCallbackQuery" && String(c.body.text || "").includes("Updated paperTrading")));
});

await t("input-field non-gmgn persists", async () => {
  await fire("cfg:input:idleScreeningCooldownMin", {
    isCallback: true,
    callbackData: "cfg:input:idleScreeningCooldownMin",
    callbackQueryId: "cb-input",
    messageId: 11,
  });
  takeCalls();
  const ctx = await fire("33");
  const saved = readUserConfig();
  assert.strictEqual(ctx.handled, true);
  assert.strictEqual(saved.idleScreeningCooldownMin, 33);
});

await t("gmgn button persists only to gmgn-config", async () => {
  const userBefore = JSON.stringify(readUserConfig());
  const ctx = await fire("cfg:set:gmgnInterval:1h", {
    isCallback: true,
    callbackData: "cfg:set:gmgnInterval:1h",
    callbackQueryId: "cb-gmgn",
    messageId: 12,
  });
  const out = takeCalls();
  assert.strictEqual(ctx.handled, true);
  assert.strictEqual(JSON.stringify(readUserConfig()), userBefore, "user-config unchanged");
  assert.strictEqual(readGmgnConfig().interval, "1h");
  assert.ok(out.some((c) => c.method === "answerCallbackQuery" && String(c.body.text || "").includes("Updated gmgnInterval")));
});

await t("gmgn preferred/dump pending input parses comma-list only", async () => {
  await fire("cfg:input:gmgnPreferredKolNames", {
    isCallback: true,
    callbackData: "cfg:input:gmgnPreferredKolNames",
    callbackQueryId: "cb-gmgn-list",
    messageId: 13,
  });
  takeCalls();
  await fire("alice, bob");
  assert.deepStrictEqual(readGmgnConfig().preferredKolNames, ["alice", "bob"]);

  await fire("cfg:input:gmgnMinMcap", {
    isCallback: true,
    callbackData: "cfg:input:gmgnMinMcap",
    callbackQueryId: "cb-gmgn-number",
    messageId: 14,
  });
  takeCalls();
  await fire("345000");
  assert.strictEqual(readGmgnConfig().minMcap, 345000, "numeric GMGN parsing unchanged");
  assert.ok(!JSON.stringify(readUserConfig()).includes("gmgnPreferredKolNames"));
});

console.log(`\nSETTINGS-MENU(${mode}): ${pass}/${pass + fail} lolos`);
process.exit(fail ? 1 : 0);
