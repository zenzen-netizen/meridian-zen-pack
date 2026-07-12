// Patch 05: titik hook "prompt:build" post-transform di agent.js — SESUDAH
// buildSystemPrompt(...) render, plugin boleh GANTI string prompt (SYNC).
// prompt.js vanilla TIDAK disentuh (desain terkunci owner); semua transform
// hidup di plugin 40-prompt-racikan.
//
// AKSES HOOKS: __zenpackHooks patch 01 = binding module-local index.js, BUKAN
// globalThis (grep globalThis di pack = nol). agent.js = modul lain → tak bisa
// pakai bare __zenpackHooks / globalThis. Call site ada di FUNGSI async & idiom
// sekitar (agent.js pakai `await import("./signal-weights.js")` dst) → akses via
// dynamic import hooks.js. hooks.js ESM singleton → registry Map SAMA dgn tempat
// plugin register → handler kena. Degrade-safe: hooks.js absen → catch → prompt
// utuh (perilaku vanilla). Idempotent lewat replaceLine (NEW mengandung marker).
const OLD = `  const systemPrompt = buildSystemPrompt(agentType, portfolio, positions, stateSummary, lessons, perfSummary, weightsSummary, decisionSummary);`;

const NEW = [
  `  let systemPrompt = buildSystemPrompt(agentType, portfolio, positions, stateSummary, lessons, perfSummary, weightsSummary, decisionSummary);`,
  `  // [zen-pack:05] hook prompt:build (post-transform) — plugin boleh ganti prompt (SYNC).`,
  `  try {`,
  `    const { emitSync } = await import("./zenpack-lib/hooks.js");`,
  `    const __zpPrompt = emitSync("prompt:build", { agentType, prompt: systemPrompt });`,
  `    if (typeof __zpPrompt?.prompt === "string") systemPrompt = __zpPrompt.prompt;`,
  `  } catch { /* zen-pack prompt hook absent — perilaku vanilla */ }`,
].join("\n");

export default [
  { file: "agent.js", marker: "zen-pack:05-prompt-hook", replaces: [
    { old: OLD, new: NEW },
  ]},
];
