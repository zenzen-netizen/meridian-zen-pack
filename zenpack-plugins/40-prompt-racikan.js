// Plugin 40: transform system-prompt (hook "prompt:build", patch 05, SYNC).
// POLA A post-transform: prompt.js vanilla TIDAK disentuh; semua kustomisasi
// fork prompt.js hidup DI SINI, jalan atas STRING PROMPT HASIL RENDER vanilla.
// FAIL-LOUD: anchor miss = console.warn + prompt utuh (degrade bersih), JANGAN
// diam-diam. Transform per agentType (SCREENER/MANAGER/GENERAL) meniru cabang
// buildSystemPrompt vanilla. Recon + peta anchor: notes/fase-4.2-progress.md.
//
// DEFER (utang → 6.4/6.5): blok timeProfile (getTimeProfileForPrompt) +
// narrativeProfile (getNarrativeProfileForPrompt) — dep fork lessons.js absen
// vanilla. TIDAK diport → plugin TIDAK import lessons.
import { config } from "../config.js";

// Port VERBATIM fork prompt.js:21-38. Racikan-borne prompt rules dari
// config.promptNotes (dibawa preset aktif). Tak ada notes utk role → "".
function racikanRules(role) {
  const notes = config.promptNotes?.[role] ?? [];
  if (!notes.length) return "";
  const src = config.activeSetup ? ` — carried by racikan "${config.activeSetup}"` : "";
  return `RACIKAN RULES${src} (HARD instructions from the loaded config; when they conflict with a soft guideline above, RACIKAN RULES win — they never override HARD RULE or mechanical safety checks):
${notes.map((n) => `- ${n}`).join("\n")}

`;
}

// FAIL-LOUD helper: anchor tak ketemu → warn + kembalikan prompt apa adanya.
// Ketemu → replace SEKALI (String.replace first-occurrence).
function mustReplace(prompt, oldStr, newStr, label) {
  if (!prompt.includes(oldStr)) {
    console.warn(`[zen-pack:40] anchor miss: ${label}`);
    return prompt;
  }
  return prompt.replace(oldStr, newStr);
}

// ── SCREENER (fork prompt.js:114-158) ──────────────────────────────────────
function transformScreener(p) {
  // T2 GANTI kalimat "job"
  p = mustReplace(p,
    "All candidates are pre-loaded. Your job: pick the highest-conviction candidate and call deploy_position. active_bin is pre-fetched.",
    "All candidates are pre-loaded. Your job: deploy only when at least one candidate has real conviction. active_bin is pre-fetched.",
    "T2 screener-job");

  // T3 GANTI top10 → interpolasi config
  p = mustReplace(p,
    "- top10 > 60% → concentrated, risky",
    `- top10 > ${config.screening.maxTop10Pct}% → concentrated, risky`,
    "T3 top10");

  // T4 SISIP single-candidate-skip setelah "- no narrative + no smart wallets → skip"
  p = mustReplace(p,
    "- no narrative + no smart wallets → skip\n",
    "- no narrative + no smart wallets → skip\n- If only one candidate is returned, do not deploy by default. Treat it as \"maybe nothing is good enough\"; deploy only if it still has a strong narrative, smart-wallet confirmation, and clean pool metrics.\n",
    "T4 single-candidate-skip");

  // T1b SISIP racikanRules("screener") sebelum NARRATIVE QUALITY
  p = mustReplace(p,
    "NARRATIVE QUALITY (your main judgment call):",
    `${racikanRules("screener")}NARRATIVE QUALITY (your main judgment call):`,
    "T1b racikan-screener");

  // T5 GANTI blok DEPLOY RULES (COMPOUNDING tetap; 4 baris bawah diganti)
  const t5old =
`- bins_below = round(config.strategy.minBinsBelow + (candidate volatility/5)*(config.strategy.maxBinsBelow-config.strategy.minBinsBelow)) clamped to [minBinsBelow,maxBinsBelow]. Volatility must be a positive number; 0/unknown means skip.
- Use amount_y only, keep amount_x=0 and bins_above=0.
- Bin steps must be [80-125].
- Pick ONE pool only when conviction is real. If only one weak candidate survives, skip and explain why none qualify.`;
  // NEW port VERBATIM fork prompt.js:151-155 (interpolasi config).
  const t5new =
`- ${(config.strategy.strategyLock ?? "default") !== "default"
    ? `strategy = ${config.strategy.strategyLock} — LOCKED by config (strategyLock). Enforced mechanically; any other value will be overridden.`
    : `strategy: default ${config.strategy.strategy}. You may pick spot/bid_ask/curve per pool if conditions clearly favor it; omit the field to use the default.`}
- bins_below = round(${config.strategy.minBinsBelow} + (candidate volatility/5)*${config.strategy.maxBinsBelow - config.strategy.minBinsBelow}) clamped to [${config.strategy.minBinsBelow},${config.strategy.maxBinsBelow}]. bins_above = 0.
- Bin steps must be [${config.screening.minBinStep}-${config.screening.maxBinStep}].
- Pick ONE pool only if it qualifies. Otherwise explain why none qualify.`;
  p = mustReplace(p, t5old, t5new, "T5 deploy-rules");

  // T6 SISIP convictionHint (gated experiments.convictionSizing) — sesudah blok
  // DEPLOY RULES, sebelum weights/lessons/Timestamp. OFF → tak emit (parity fork).
  if (config.experiments?.convictionSizing) {
    const hint = `CONVICTION SIZING (experimental, ON): on deploy_position, set conviction=low|medium|high for THIS setup. high → larger size, low → smaller, by at most ±${config.experiments.convictionSizingMaxAdjustPct ?? 30}% and ALWAYS within your min/max. Use high only for genuinely strong setups; default medium.`;
    p = mustReplace(p,
      "- Pick ONE pool only if it qualifies. Otherwise explain why none qualify.\n\n",
      `- Pick ONE pool only if it qualifies. Otherwise explain why none qualify.\n\n${hint}\n\n`,
      "T6 convictionHint");
  }
  return p;
}

// ── MANAGER (fork prompt.js:50, lean early-return prompt) ───────────────────
function transformManager(p) {
  // T1a SISIP racikanRules("manager") di tail lean prompt (sesudah BEHAVIORAL
  // CORE, sebelum lessons/Timestamp). Notes kosong → no-op (identik vanilla).
  return mustReplace(p,
    "Guidelines are heuristics.\n\n",
    `Guidelines are heuristics.\n\n${racikanRules("manager")}`,
    "T1a racikan-manager");
}

// ── GENERAL / default (fork prompt.js:179-197) ─────────────────────────────
function transformGeneral(p) {
  // T7 SISIP INTENT DISAMBIGUATION sesudah "The user's instruction IS the
  // confirmation." (anchor HANYA ada di general — manager lean tak punya frasa).
  const intent =
`INTENT DISAMBIGUATION (settings vs trade) — read before any action:
- A request to "ubah / set / ganti / naikin / turunin / atur <something>" (change/raise/lower a value) is a SETTINGS change → use update_config. It is NOT a trade. Words like "deploy", "amount", or "size" inside such a phrase name the SETTING (e.g. deployAmountSol), not an order to move funds. Example: "ubah deploy jadi 0.3" / "set deploy amount to 0.3" → update_config(deployAmountSol=0.3), NEVER deploy_position.
- Only OPEN a position (deploy_position) or CLOSE one (close_position) / claim / swap when the user CLEARLY asks for that trade itself — e.g. "buka posisi di <pool>", "deploy 0.5 SOL into <pool>", "tutup TURTLE", "close position 2".
- If it is genuinely unclear whether the user wants a settings change or a real trade, ASK one short clarifying question first — do NOT open/close a position on a guess.`;
  p = mustReplace(p,
    "The user's instruction IS the confirmation.\n\n",
    `The user's instruction IS the confirmation.\n\n${intent}\n\n`,
    "T7 intent-disambiguation");

  // T8 SISIP racikanRules("general") di ekor general (sebelum Timestamp). Fork
  // TAMBAH blank line → notes kosong pun emit 1 "\n" ekstra (selalu jalan).
  p = mustReplace(p,
    "unless the current candidate is clearly stronger.\n\n",
    `unless the current candidate is clearly stronger.\n\n${racikanRules("general")}\n`,
    "T8 racikan-general");
  return p;
}

// Transform utama — cabang per agentType meniru buildSystemPrompt vanilla.
export function transformPrompt(agentType, prompt) {
  if (typeof prompt !== "string") return prompt;
  if (agentType === "SCREENER") return transformScreener(prompt);
  if (agentType === "MANAGER") return transformManager(prompt);
  return transformGeneral(prompt);
}

export const manifest = { name: "zenpack-prompt-racikan", priority: 100 };

export function register(hooks) {
  hooks.on("prompt:build", (ctx) => {
    ctx.prompt = transformPrompt(ctx.agentType, ctx.prompt);
  });
}
