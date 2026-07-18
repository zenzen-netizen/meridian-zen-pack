import assert from "node:assert";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/money-commands.test.mjs <path-target>"); process.exit(1); }
process.chdir(target);
process.env.DRY_RUN = "true";
process.env.TELEGRAM_BOT_TOKEN ||= "test";
process.env.TELEGRAM_CHAT_ID ||= "123";
process.env.OPENROUTER_API_KEY ||= "dummy";
process.env.WALLET_PRIVATE_KEY ||= "11111111111111111111111111111111";
process.env.RPC_URL ||= "http://127.0.0.1:8899";

const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ method: String(url).split("/").pop(), body });
  return { ok: true, json: async () => ({ ok: true, result: { message_id: 77 } }), text: async () => "" };
};

const hooks = await import(pathToFileURL(join(target, "zenpack-lib/hooks.js")).href);
const plugin = await import(pathToFileURL(join(target, "zenpack-plugins/70-money-commands.js")).href);
const { config } = await import(pathToFileURL(join(target, "config.js")).href);
hooks._reset();
plugin.__test.reset();
plugin.register(hooks);

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (e) { console.log("  ❌", name, "→", e.message); fail++; }
}
const take = () => calls.splice(0);
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function fire(text, extra = {}, early = false) {
  return hooks.run("telegram:command", { text, early, msg: { text, ...extra }, reply: () => {} });
}

await t("intent routing 6 kasus deploy/close/setting id+en", () => {
  assert.strictEqual(plugin.routeIntent("deploy pool ini").agentRole, "SCREENER");
  assert.strictEqual(plugin.routeIntent("buka posisi sekarang").agentRole, "SCREENER");
  assert.strictEqual(plugin.routeIntent("close posisi ini").agentRole, "GENERAL");
  assert.strictEqual(plugin.routeIntent("tutup posisi ini").agentRole, "GENERAL");
  assert.strictEqual(plugin.routeIntent("change deploy amount to 1").agentRole, "GENERAL");
  assert.strictEqual(plugin.routeIntent("ubah jumlah deploy jadi 1").agentRole, "GENERAL");
});

await t("history plugin cap 20 verbatim", () => {
  plugin.__test.reset();
  for (let i = 0; i < 12; i++) plugin.__test.appendHistory(`u${i}`, `a${i}`);
  assert.strictEqual(plugin.__test.sessionHistory.length, 20);
  assert.strictEqual(plugin.__test.sessionHistory[0].content, "u2");
});

await t("early ordinary text defers; normal pass handles fallback", async () => {
  plugin.__test.reset(); take();
  let routed = null;
  plugin.__test.setRuntime({ agentLoop: async (...args) => { routed = args; return { content: "ok" }; } });
  let ctx = await fire("cek saldo", {}, true);
  assert.ok(!ctx.handled, "early plain text must defer");
  ctx = await fire("cek saldo");
  assert.strictEqual(ctx.handled, true);
  assert.strictEqual(routed[3], "GENERAL");
});

await t("handled pending-input from earlier plugin never reaches fallback", async () => {
  hooks._reset();
  let called = 0;
  hooks.on("telegram:command", (ctx) => { ctx.handled = true; }, 90);
  plugin.__test.setRuntime({ agentLoop: async () => { called++; return { content: "bad" }; } });
  plugin.register(hooks);
  const ctx = await fire("33");
  assert.strictEqual(ctx.handled, true);
  assert.strictEqual(called, 0);
  hooks._reset();
  plugin.register(hooks);
});

await t("confirm accept", async () => {
  plugin.__test.reset(); take();
  const pending = plugin.__test.requestActionConfirmation("close_position", { position_address: "P" });
  await tick();
  await fire("confirm:yes", { isCallback: true, callbackQueryId: "yes" }, true);
  assert.strictEqual(await pending, true);
});

await t("confirm deny", async () => {
  plugin.__test.reset(); take();
  const pending = plugin.__test.requestActionConfirmation("swap_token", { amount: 1 });
  await tick();
  await fire("confirm:no", { isCallback: true, callbackQueryId: "no" }, true);
  assert.strictEqual(await pending, false);
});

await t("confirm timeout edits expired and resolves false", async () => {
  plugin.__test.reset(); take();
  const realSetTimeout = globalThis.setTimeout;
  let timeoutFn;
  globalThis.setTimeout = (fn) => { timeoutFn = fn; return 123; };
  try {
    const pending = plugin.__test.requestActionConfirmation("claim_fees", { position_address: "P" });
    await tick();
    await timeoutFn();
    assert.strictEqual(await pending, false);
    assert.ok(take().some((c) => c.method === "editMessageText" && c.body.text.includes("Expired")));
  } finally { globalThis.setTimeout = realSetTimeout; }
});

await t("confirm duplicate single-flight sends one prompt", async () => {
  plugin.__test.reset(); take();
  const p1 = plugin.__test.requestActionConfirmation("deploy_position", { pool_address: "X", amount_y: 0.5 });
  const p2 = plugin.__test.requestActionConfirmation("deploy_position", { pool_address: "X", amount_y: 0.5 });
  await tick();
  assert.strictEqual(take().filter((c) => c.method === "sendMessage").length, 1);
  await fire("confirm:yes", { isCallback: true, callbackQueryId: "dupe" }, true);
  assert.deepStrictEqual(await Promise.all([p1, p2]), [true, true]);
});

await t("/screen owns cache and /candidates renders it", async () => {
  plugin.__test.reset(); take();
  plugin.__test.setRuntime({ getTopCandidates: async () => ({ candidates: [
    { name: "A", pool: "PA", volatility: 1 }, { name: "B", pool: "PB", volatility: 2 },
  ] }) });
  assert.strictEqual((await fire("/screen")).handled, true);
  assert.strictEqual((await fire("/candidates")).handled, true);
  assert.ok(take().some((c) => c.body?.text?.includes("Top candidates (2)")));
});

await t("paper deploy uses fork sizing and ZERO-TX", async () => {
  take();
  const old = { mode: config.management.sizingMode, rent: config.management.rentPerPositionSol };
  config.management.sizingMode = "maximize";
  config.management.rentPerPositionSol = 0.057;
  let toolCall;
  let paperResult;
  plugin.__test.setRuntime({
    getWalletBalances: async () => ({ sol: 2 }),
    getMyPositions: async () => ({ total_positions: 0, positions: [] }),
    executeTool: async (name, args) => { toolCall = { name, args }; paperResult = { success: true, dry_run: true, txs: [] }; return paperResult; },
  });
  const ctx = await fire("/deploy 2");
  config.management.sizingMode = old.mode; config.management.rentPerPositionSol = old.rent;
  assert.strictEqual(ctx.handled, true);
  assert.strictEqual(toolCall.name, "deploy_position");
  assert.strictEqual(toolCall.args.amount_y, 0.543);
  assert.strictEqual(paperResult.dry_run, true);
  assert.deepStrictEqual(paperResult.txs, []);
  assert.ok(take().some((c) => c.body?.text?.includes("Deploy B terkirim")));
});

await t("lone candidate renders JG-3 no-deploy and executes ZERO tools", async () => {
  plugin.__test.reset(); take();
  let executions = 0;
  plugin.__test.setLatestCandidates([{ name: "Solo", pool: "PS", volatility: 1, is_wash: true }]);
  plugin.__test.setRuntime({
    checkSmartWalletsOnPool: async () => ({ in_pool: [] }),
    getTokenNarrative: async () => null, getTokenInfo: async () => null,
    executeTool: async () => { executions++; return { success: true }; },
  });
  await fire("/deploy 1");
  assert.strictEqual(executions, 0);
  assert.ok(take().some((c) => c.body?.text?.includes("NO DEPLOY")));
});

await t("/closeall renders tree with solMode-aware PnL", async () => {
  take();
  plugin.__test.setRuntime({
    getMyPositions: async () => ({ positions: [{ pair: "A/SOL", position: "A" }, { pair: "B/SOL", position: "B" }] }),
    closePosition: async ({ position_address }) => position_address === "A" ? { success: true, pnl_usd: 1.25 } : { success: false, error: "blocked" },
  });
  const ctx = await fire("/closeall");
  assert.strictEqual(ctx.handled, true);
  const out = take().map((c) => c.body?.text || "").join("\n");
  assert.ok(out.includes("Close-all"));
  assert.ok(out.includes("A/SOL"));
  assert.ok(out.includes("B/SOL"));
  assert.ok(out.includes("blocked"));
});

await t("/set and /setcfg remain outside plugin 70", async () => {
  assert.ok(!(await fire("/set 1 note")).handled);
  assert.ok(!(await fire("/setcfg gasReserve 1")).handled);
});

console.log(`\nmoney-commands: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
