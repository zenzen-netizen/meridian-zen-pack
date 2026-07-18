// Patch 29: remaining fork agentLoop blocks 3-6.
// Snippets hold verbatim fork text where template literals/backslashes make inline
// strings fragile. Applied after patch 11; patch 11 has `already` migration anchors
// for the two regions whose final fork form patch 29 completes.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip29", n), "utf8").replace(/\n$/, "");

const SCREENER = String.raw`const SCREENER_TOOLS = new Set(["deploy_position", "get_top_candidates", "search_pools", "get_time_profile", "get_narrative_profile", "get_wallet_balance", "get_my_positions"]);`;
const IMPORT_OLD = String.raw`import { getDecisionSummary } from "./decision-log.js";`;
const IMPORT_NEW = `${IMPORT_OLD}\nimport { recordLlmCost } from "./llm-cost-tracker.js";`;
const OPTIONS_OLD = String.raw`  const { interactive = false, onToolStart = null, onToolFinish = null } = options;`;
const OPTIONS_NEW = String.raw`  const { interactive = false, onToolStart = null, onToolFinish = null, onConfirmRequired = null, allowNoToolFinal = false } = options;`;
const TOKENS_OLD = String.raw`            max_tokens: maxOutputTokens ?? config.llm.maxTokens,`;
const TOKENS_NEW = String.raw`            max_tokens: maxOutputTokens ?? (agentType === "GENERAL" ? config.llm.generalMaxTokens : config.llm.maxTokens),
            usage: { include: true }, // OpenRouter returns per-call cost in response.usage`;
const COST_OLD = String.raw`          response = await activeClient.chat.completions.create(reqParams); // [zen-pack:11] blok 1c`;
const CONTENT_OLD = String.raw`              content: "I couldn't complete that reliably — the model emitted tool definitions as text instead of calling them. Please retry.",`;
const GUARD_OLD = String.raw`        if (mustUseRealTool && !sawToolCall) {`;

export default [{
  file: "agent.js",
  marker: "zen-pack:29-agentloop-money",
  replaces: [
    { old: SCREENER, new: `${SCREENER}\n${snip("4-confirm-tools.txt")}` },
    { old: IMPORT_OLD, new: IMPORT_NEW },
    { old: OPTIONS_OLD, new: OPTIONS_NEW },
    { old: TOKENS_OLD, new: TOKENS_NEW },
    { old: COST_OLD, new: snip("5-cost-call.txt") },
    { old: snip("3-arg-repair-OLD.txt"), new: snip("3-arg-repair-NEW.txt") },
    { old: CONTENT_OLD, new: snip("6-allow-content.txt") },
    { old: GUARD_OLD, new: snip("6-allow-guard.txt") },
    { old: snip("3-run-tool-OLD.txt"), new: snip("3-run-tool-NEW.txt") },
  ],
}];
