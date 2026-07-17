// Gerbang 5.10: telegram.js display/notif patch 18.
// Semua network di-stub: tidak ada call Telegram/Jupiter nyata.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const target = process.argv[2];
if (!target) { console.error("pakai: node tests/telegram-ext.test.mjs <path-target>"); process.exit(1); }
process.chdir(target);

process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.TELEGRAM_CHAT_ID = "12345";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (e) { console.log("  ❌", name, "→", e.message); fail++; }
}

function okJson(extra = {}) {
  return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 100 }, ...extra }), text: async () => "OK" };
}

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: String(url), method: options.method || "GET", body });
    return handler({ url: String(url), options, body, calls });
  };
  return calls;
}

async function importTelegram() {
  return import(`${pathToFileURL(join(target, "telegram.js")).href}?t=${Date.now()}-${Math.random()}`);
}

await t("sendMessage split >4096: cut newline, tail no leading newline", async () => {
  const calls = stubFetch(() => okJson());
  const tg = await importTelegram();
  const long = `${"a".repeat(4000)}\n${"b".repeat(300)}`;
  await tg.sendMessage(long);
  const msgs = calls.filter((c) => c.body?.text != null);
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].body.text, "a".repeat(4000));
  assert.strictEqual(msgs[1].body.text.startsWith("\n"), false);
  assert.strictEqual(msgs[1].body.text, "b".repeat(300));
});

await t("sendMessage pendek -> 1 chunk utuh", async () => {
  const calls = stubFetch(() => okJson());
  const tg = await importTelegram();
  await tg.sendMessage("short message");
  const msgs = calls.filter((c) => c.body?.text != null);
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].body.text, "short message");
});

await t("sendHTML parse gagal -> retry plain", async () => {
  let n = 0;
  const calls = stubFetch(() => {
    n++;
    if (n === 1) return { ok: false, status: 400, text: async () => "can't parse entities" };
    return okJson();
  });
  const tg = await importTelegram();
  await tg.sendHTML("<b>Hello</b> <code>world</code>");
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0].body.parse_mode, "HTML");
  assert.strictEqual(calls[1].body.parse_mode, undefined);
  assert.strictEqual(calls[1].body.text, "Hello world");
});

await t("notifyClose memakai estimasi gas reports.js", async () => {
  const solMint = "So11111111111111111111111111111111111111112";
  const calls = stubFetch(({ url }) => {
    if (url.includes("api.telegram.org")) return okJson();
    return {
      ok: true,
      status: 200,
      json: async () => ({ [solMint]: { usdPrice: 150, priceChange24h: 1, liquidity: 1_000_000 } }),
      text: async () => "OK",
    };
  });
  const tg = await importTelegram();
  // Bentuk payload setelah executor memetakan result kategori-H fork.
  await tg.notifyClose({
    pair: "TEST/SOL", pnlUsd: 3.5, pnlPct: 7, peakPnlPct: 10,
    feesUsd: 0.5, reason: "PnL 5%", lesson: "fixture lesson",
  });
  const msg = calls.find((c) => c.url.includes("api.telegram.org") && c.body?.parse_mode === "HTML");
  assert.ok(msg, "telegram HTML message captured");
  assert.ok(msg.body.text.includes("Closed"));
  assert.ok(msg.body.text.includes("+$3.50"), msg.body.text);
  assert.ok(msg.body.text.includes("Fee panen"), msg.body.text);
  assert.ok(msg.body.text.includes("Give-back"), msg.body.text);
  assert.ok(msg.body.text.includes("fixture lesson"), msg.body.text);
  assert.ok(msg.body.text.includes("Gas ~0.00006 SOL"), msg.body.text);
});

await t("live message labels: smart wallets + active bin", async () => {
  const calls = stubFetch(() => okJson());
  const tg = await importTelegram();
  const live = await tg.createLiveMessage("Live");
  await live.toolFinish("check_smart_wallets_on_pool", { in_pool: ["a", "b"] }, true);
  await new Promise((r) => setTimeout(r, 350));
  await live.toolFinish("get_active_bin", { binId: 42 }, true);
  await new Promise((r) => setTimeout(r, 350));
  await live.finalize("Done");
  const text = calls.map((c) => c.body?.text || "").join("\n");
  assert.ok(text.includes("2 smart wallets"), text);
  assert.ok(text.includes("bin 42"), text);
});

console.log(`\nTELEGRAM-EXT: ${pass}/${pass + fail} lolos`);
process.exit(fail ? 1 : 0);
