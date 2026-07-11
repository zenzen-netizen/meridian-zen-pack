import { on, off, run, emitSync, _countHandlers, _reset } from "../lib/hooks.js";
import assert from "node:assert";

let pass = 0, fail = 0;
async function t(name, fn) {
  _reset();
  try { await fn(); console.log("  ✅", name); pass++; }
  catch (e) { console.log("  ❌", name, "→", e.message); fail++; }
}

await t("register + run: handler dipanggil, ctx dikembalikan", async () => {
  let seen = null;
  on("evt", (ctx) => { seen = ctx.x; });
  const out = await run("evt", { x: 42 });
  assert.strictEqual(seen, 42);
  assert.strictEqual(out.x, 42);
});

await t("run MENUNGGU handler async (await beneran)", async () => {
  const order = [];
  on("evt", async (ctx) => {
    await new Promise((r) => setTimeout(r, 20));
    order.push("async-selesai");
  });
  on("evt", (ctx) => { order.push("handler-2"); }, 200);
  await run("evt", {});
  // kalau tidak di-await, "handler-2" akan mendahului "async-selesai"
  assert.deepStrictEqual(order, ["async-selesai", "handler-2"]);
});

await t("priority: angka kecil jalan duluan", async () => {
  const order = [];
  on("evt", () => order.push("C"), 300);
  on("evt", () => order.push("A"), 10);
  on("evt", () => order.push("B"), 100);
  await run("evt", {});
  assert.deepStrictEqual(order, ["A", "B", "C"]);
});

await t("cancel (veto): rantai berhenti, handler sisa TIDAK jalan", async () => {
  const order = [];
  on("evt", (ctx) => { order.push("1"); ctx.cancel = true; }, 10);
  on("evt", (ctx) => { order.push("2"); }, 20);
  const out = await run("evt", {});
  assert.deepStrictEqual(order, ["1"]);
  assert.strictEqual(out.cancel, true);
});

await t("result: handler bisa mengganti hasil via ctx.result", async () => {
  on("evt", (ctx) => { ctx.result = "diganti"; });
  const out = await run("evt", { result: "asli" });
  assert.strictEqual(out.result, "diganti");
});

await t("emitSync: display-mode, tak bisa veto alur core", async () => {
  const order = [];
  on("evt", (ctx) => { ctx.cancel = true; order.push("x"); });
  const out = emitSync("evt", {});
  assert.strictEqual(out.cancel, true); // flag ke-set, tapi emitSync tak memutus core
  assert.deepStrictEqual(order, ["x"]);
});

await t("off / unsubscribe: handler bisa dilepas", async () => {
  const h = () => {};
  const unsub = on("evt", h);
  assert.strictEqual(_countHandlers("evt"), 1);
  unsub();
  assert.strictEqual(_countHandlers("evt"), 0);
});

await t("event tanpa handler: run aman (tak error)", async () => {
  const out = await run("kosong", { a: 1 });
  assert.strictEqual(out.a, 1);
});

console.log(`\n  HASIL: ${pass} lulus, ${fail} gagal`);
process.exit(fail === 0 ? 0 : 1);
