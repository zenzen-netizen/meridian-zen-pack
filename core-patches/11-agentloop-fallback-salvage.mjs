// Patch 11: agentLoop blok 1 (fallbackClient failover) + blok 2 (salvage tool-dump).
// Scope owner-locked 5.4 = HANYA blok 1+2. Blok 3/4/5/6 DEFER 7.x (lihat manifest).
//
// NEW-content disimpan verbatim-fork di snip11/*.txt lalu dibaca readFileSync —
// blok memuat backtick (log template) + backslash (regex fence \s\S, \n) sekaligus,
// yang String.raw (pecah di backtick) & double-quote (pecah di backslash) tak bisa
// pegang bareng. Snippet file = nol escaping, jaminan verbatim. Marker [zen-pack:11].
//
// Blok 1 fail-open: fallbackClient = env LLM_FALLBACK_BASE_URL ? new : null → env
// absen (kasus vanilla-test) = null = perilaku vanilla persis, nol crash.
// Blok 2b (reject-dump): allowNoToolFinal (blok 6) DEFER — ternary dilepas di snippet,
// hanya cabang non-allowNoToolFinal dipertahankan (split bersih, FASE A vonis).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const M = "zen-pack:11-agentloop-fallback-salvage";
// Baca snippet, buang SATU newline trailing (biar replaceLine tak sisip baris kosong).
const snip = (n) => readFileSync(join(here, "snip11", n), "utf8").replace(/\n$/, "");

// ── OLD anchors (vanilla-test/agent.js, main; tiap count=1, diverifikasi FASE A) ──
const B1A_OLD = String.raw`const DEFAULT_MODEL = process.env.LLM_MODEL || "openrouter/healer-alpha";`;
const B1B_OLD = String.raw`      let usedModel = activeModel;`;
const B1C_OLD = String.raw`          response = await client.chat.completions.create(reqParams);`;
const B1C_NEW = String.raw`          response = await activeClient.chat.completions.create(reqParams); // [zen-pack:11] blok 1c`;
const B1D_OLD = String.raw`          if (attempt === 1 && usedModel !== FALLBACK_MODEL) {`;
const B2C_OLD = String.raw`  let noToolRetryCount = 0;`;
const B2B_OLD = String.raw`      messages.push(msg);`;
const B2D_OLD = String.raw`        if (mustUseRealTool && !sawToolCall) {`;

export default [
  {
    file: "agent.js",
    marker: M,
    // Blok 2a top-level (parseContentToolCalls + Set) di-append; fn hoisted, const
    // dipakai runtime saat agentLoop jalan (bukan saat module eval) → aman di akhir file.
    append: snip("2a-parse.txt"),
    replaces: [
      { old: B1A_OLD, new: snip("1a-fallbackclient.txt") }, // blok 1a decl
      { old: B1B_OLD, new: snip("1b-activeclient.txt") },   // blok 1b routing
      { old: B1C_OLD, new: B1C_NEW, already: "if (u) recordLlmCost({ role: agentType" }, // blok 1c; patch29 final form
      { old: B1D_OLD, new: snip("1d-failover.txt") },        // blok 1d failover elif
      { old: B2C_OLD, new: snip("2c-counters.txt") },        // blok 2c counters
      { old: B2B_OLD, new: snip("2b-salvage.txt") },         // blok 2b salvage
      { old: B2D_OLD, new: snip("2d-reject.txt"), already: "if (mustUseRealTool && !sawToolCall && !allowNoToolFinal)" }, // patch29 final form
    ],
  },
];
