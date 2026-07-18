// Patch 28: early telegram hook for settings-menu surfaces that vanilla consumes
// before Patch 03b can run.
//
// Patch 03b remains the general command hook before /briefing. This patch is
// intentionally conditional: callbacks, /settings aliases, and non-command text
// (needed for plugin-owned _pendingInput). Other slash commands keep the old
// queue/busy behavior and reach 03b at its existing anchor.
const OLD = [
  `  const text = msg?.text?.trim();`,
  `  if (!text) return;`,
].join("\n");

const LEGACY_NEW = [
  `  const text = msg?.text?.trim();`,
  `  if (!text) return;`,
  `  // [zen-pack:28] early settings hook — covers cfg callbacks, /settings, and pending text before vanilla consumes them.`,
  `  if (msg?.isCallback || text === "/settings" || text === "/menu" || text === "/configmenu" || !text.startsWith("/")) {`,
  `    const zpCtx = await __zenpackHooks.run("telegram:command", { text, msg, reply: (t) => sendMessage(t).catch(() => {}) });`,
  `    if (zpCtx.handled) return;`,
  `  }`,
].join("\n");

const CALL_OLD = `    const zpCtx = await __zenpackHooks.run("telegram:command", { text, msg, reply: (t) => sendMessage(t).catch(() => {}) });`;
const CALL_NEW = `    const zpCtx = await __zenpackHooks.run("telegram:command", { text, msg, early: true, reply: (t) => sendMessage(t).catch(() => {}) });`;
const EARLY_NEW = LEGACY_NEW.replace(CALL_OLD, CALL_NEW);

export default [
  {
    file: "index.js",
    marker: "zen-pack:28-telegram-settings-hook",
    replaces: [
      { old: OLD, new: LEGACY_NEW, already: CALL_NEW },
      { old: LEGACY_NEW, new: EARLY_NEW },
    ],
  },
];
