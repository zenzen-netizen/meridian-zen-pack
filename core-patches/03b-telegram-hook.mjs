// Patch 03b: titik hook "telegram:command" di telegramHandler index.js —
// TEPAT SEBELUM `if (text === "/briefing")` (setelah cek /settings + queue/busy:
// command custom tak menyerobot antrian; fallback agent tetap jalan terakhir).
// Kontrak ctx (roadmap §1.1): { text, msg, reply }; handler set ctx.handled -> return.
// __zenpackHooks = namespace import yang sudah ditanam patch 01.
const ANCHOR_LINE = `  if (text === "/briefing") {`;

export default [
  { file: "index.js", replaces: [
    { old: ANCHOR_LINE,
      new: [
        `  // [zen-pack:03b] hook telegram:command — plugin bisa handle sebelum rantai vanilla`,
        `  {`,
        `    const zpCtx = await __zenpackHooks.run("telegram:command", { text, msg, reply: (t) => sendMessage(t).catch(() => {}) });`,
        `    if (zpCtx.handled) return;`,
        `  }`,
        ANCHOR_LINE,
      ].join("\n") },
  ]},
];
