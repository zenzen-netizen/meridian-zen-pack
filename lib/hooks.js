// lib/hooks.js — middleware pipeline (await-able), BUKAN EventEmitter.
// Kontrak ctx:
//   ctx.cancel = true  -> core batalkan aksi (veto), rantai berhenti
//   ctx.result = X     -> core pakai X sebagai hasil pengganti
//   ctx.meta           -> data tambahan antar-handler
const registry = new Map(); // event -> [{priority, handler}]

export function on(event, handler, priority = 100) {
  if (typeof handler !== "function") throw new TypeError("handler must be a function");
  if (!registry.has(event)) registry.set(event, []);
  registry.get(event).push({ priority, handler });
  registry.get(event).sort((a, b) => a.priority - b.priority); // kecil = jalan duluan
  return () => off(event, handler); // pengembalian: fungsi untuk melepas handler
}

export function off(event, handler) {
  const list = registry.get(event);
  if (!list) return;
  registry.set(event, list.filter((h) => h.handler !== handler));
}

// Money-logic & apa pun yang bisa ubah alur -> pakai run() (async, ditunggu).
export async function run(event, ctx = {}) {
  for (const { handler } of registry.get(event) ?? []) {
    await handler(ctx);        // async DITUNGGU
    if (ctx.cancel) break;     // veto: hentikan rantai
  }
  return ctx;
}

// Display/log ringan saja -> pakai emitSync() (tak menunggu async, tak bisa veto alur).
export function emitSync(event, ctx = {}) {
  for (const { handler } of registry.get(event) ?? []) handler(ctx);
  return ctx;
}

export function _countHandlers(event) { return (registry.get(event) ?? []).length; }
export function _reset() { registry.clear(); } // khusus test
