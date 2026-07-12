// Gerbang 4.2 F3: GOLDEN PARITY plugin 40-prompt-racikan.
//   node tests/prompt-racikan.test.mjs <path-target-terinstall> <path-fork-ref>
// Bandingkan:
//   P = buildSystemPrompt(vanilla) + transformPrompt(plugin 40)
//   F = buildSystemPrompt(fork-ref)
// dengan fixture config SINTETIS SAMA (nilai jelas-dummy, BUKAN realistis-live).
// Normalisasi: buang baris Timestamp. timeProfile/narrativeProfile (DEFER) dijamin
// absen via fixture (narrativeProfileSignal=false + data lessons kosong → null);
// kalau bocor ("TIME-OF-DAY"/"NARRATIVE PROFILE") → FAIL keras (fixture tak isolasi).
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert";

const target = process.argv[2];
const forkRef = process.argv[3];
if (!target || !forkRef) {
  console.error("pakai: node tests/prompt-racikan.test.mjs <target> <fork-ref>");
  process.exit(1);
}

// Isolasi data: MERIDIAN_DATA_DIR ke temp kosong → fork getTimeProfileForPrompt
// baca 0 sampel → null (blok time/narrative tak muncul). Set SEBELUM import config.
process.env.MERIDIAN_DATA_DIR = mkdtempSync(join(tmpdir(), "zp-prompt-parity-"));
process.env.DRY_RUN = "true";

const vanillaPrompt = await import(pathToFileURL(join(target, "prompt.js")).href);
const vanillaCfgMod = await import(pathToFileURL(join(target, "config.js")).href);
const plugin = await import(pathToFileURL(join(target, "zenpack-plugins/40-prompt-racikan.js")).href);

const forkPrompt = await import(pathToFileURL(join(forkRef, "prompt.js")).href);
const forkCfgMod = await import(pathToFileURL(join(forkRef, "config.js")).href);

const vanillaCfg = vanillaCfgMod.config;
const forkCfg = forkCfgMod.config;

// Fixture: nilai jelas-dummy. Terapkan ke DUA config singleton (in-place mutate,
// pertahankan field lain yang dipakai renderer).
function applyFixture(cfg, { notes, conviction }) {
  Object.assign(cfg.screening, {
    timeframe: "TF_DUMMY", minTokenFeesSol: 0.111, maxBotHoldersPct: 42,
    maxTop10Pct: 55, minBinStep: 71, maxBinStep: 133,
  });
  Object.assign(cfg.strategy, {
    strategy: "spot", strategyLock: "default", minBinsBelow: 12, maxBinsBelow: 34,
  });
  cfg.experiments = {
    convictionSizing: conviction, convictionSizingMaxAdjustPct: 27,
    narrativeProfileSignal: false,
  };
  cfg.management = { dummyMgmt: "MGMT_DUMMY" };
  cfg.promptNotes = notes;
  cfg.activeSetup = notes && Object.keys(notes).length ? "DUMMYSETUP" : null;
  cfg.darwin = { enabled: false };
}

const ARGS = [{ solDummy: 1 }, { posDummy: 1 }, null, null, null, null, null]; // portfolio, positions, state, lessons, perf, weights, decision
// Normalisasi:
//  (1) blok `Config: {…}` = JSON.stringify(config) penuh yang di-embed basePrompt
//      general — MURNI ditentukan skema config.js, NOL konten prompt-template.
//      fork config.js punya field ekstra (source/categories/loneCandidateMinDegen)
//      → beda skema, DI LUAR scope 4.2 (yang diuji = transform template T1-T8).
//      Blok ini muncul sebelum INTENT/PVP/racikan general → sisanya tetap dibanding.
//      Regex: `\n}` (kurung tutup top-level tanpa indent) menandai akhir blok;
//      penutup nested selalu ber-indent (`\n  }`) → non-greedy aman.
//  (2) baris Timestamp (waktu dinamis).
const norm = (s) => s
  .replace(/Config: \{[\s\S]*?\n\}/g, "Config: {…config.js-schema, out-of-4.2…}")
  .replace(/Timestamp: [^\n]*/g, "Timestamp: <X>");

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0; while (i < n && a[i] === b[i]) i++;
  const ctx = (s) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 60));
  return `idx ${i} (len P=${a.length} F=${b.length})\n  P: ${ctx(a)}\n  F: ${ctx(b)}`;
}

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

const notesFull = {
  screener: ["DUMMY screener rule ONE", "DUMMY screener rule TWO"],
  manager: ["DUMMY manager rule"],
  general: ["DUMMY general rule"],
};

const SCEN = [
  { tag: "notesFull+convOff", notes: notesFull, conviction: false },
  { tag: "notesEmpty+convOn", notes: {}, conviction: true },
];

for (const agentType of ["SCREENER", "MANAGER", "GENERAL"]) {
  for (const sc of SCEN) {
    t(`parity ${agentType} [${sc.tag}]`, () => {
      applyFixture(vanillaCfg, sc);
      applyFixture(forkCfg, sc);

      const V = vanillaPrompt.buildSystemPrompt(agentType, ...ARGS);
      const P = plugin.transformPrompt(agentType, V);
      const F = forkPrompt.buildSystemPrompt(agentType, ...ARGS);

      // DEFER guard: blok time/narrative TIDAK boleh muncul (fixture isolasi).
      assert.ok(!F.includes("TIME-OF-DAY"), "fork bocor timeProfile — fixture tak isolasi");
      assert.ok(!F.includes("NARRATIVE PROFILE"), "fork bocor narrativeProfile");

      const np = norm(P), nf = norm(F);
      assert.strictEqual(np, nf, `parity gagal:\n${firstDiff(np, nf)}`);
    });
  }
}

// Anchor-miss (c): prompt gadungan tanpa anchor → tak crash, warning, prompt utuh.
t("anchor-miss: prompt gadungan kembali utuh + tak crash", () => {
  const bogus = "PROMPT GADUNGAN tanpa anchor apa pun.\nBaris dua.";
  for (const at of ["SCREENER", "MANAGER", "GENERAL"]) {
    const out = plugin.transformPrompt(at, bogus);
    assert.strictEqual(out, bogus, `${at}: prompt harus utuh saat anchor miss`);
  }
});

// Non-string guard.
t("non-string prompt → dikembalikan apa adanya", () => {
  assert.strictEqual(plugin.transformPrompt("SCREENER", null), null);
  assert.strictEqual(plugin.transformPrompt("SCREENER", undefined), undefined);
});

console.log(`\nprompt-racikan: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
