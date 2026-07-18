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

const NEW = [
  `  const text = msg?.text?.trim();`,
  `  if (!text) return;`,
  `  // [zen-pack:28] early settings hook — covers cfg callbacks, /settings, and pending text before vanilla consumes them.`,
  `  if (msg?.isCallback || text === "/settings" || text === "/menu" || text === "/configmenu" || !text.startsWith("/")) {`,
  `    const zpCtx = await __zenpackHooks.run("telegram:command", { text, msg, reply: (t) => sendMessage(t).catch(() => {}) });`,
  `    if (zpCtx.handled) return;`,
  `  }`,
].join("\n");

export default [
  {
    file: "index.js",
    marker: "zen-pack:28-telegram-settings-hook",
    replaces: [{ old: OLD, new: NEW }],
  },
];
