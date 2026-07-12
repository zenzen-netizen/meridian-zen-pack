# Fase 4.2 — Ekstrak custom prompt.js → plugin (POLA A: post-transform hook)

Desain terkunci (owner): prompt.js vanilla TIDAK disentuh. Patch = 1 titik
agent.js:173 (post-transform). Semua transform di plugin, FAIL-LOUD (anchor
miss = warning + skip transform itu). Bot live tak disentuh. Sandbox
~/meridian-lab/vanilla-test. git -C eksplisit.

Repo pack HEAD saat mulai: 27fdff9. Sandbox vanilla-test HEAD 5ab14b4
(terpasang stage 3.7 → F2 uninstall dulu). Call site agent.js:173 vanilla-test
= `const systemPrompt = buildSystemPrompt(agentType, portfolio, positions, stateSummary, lessons, perfSummary, weightsSummary, decisionSummary);`
— agent.js BELUM dipatch apa pun (bukan di porcelain M-list). MATCH persis.

## Fase

- [x] F1 — recon lokal (bukti file:line) + commit
- [x] F2 — patch 05-prompt-hook (agent.js:173): apply=replaced, node --check OK,
      boot hook-idle = loaded 4 plugins errors 0 + baseline 401 (identik vanilla,
      prompt tak berubah tanpa plugin), install 2x=skipped-idempotent, uninstall
      agent.js restore hash-verify clean (target porcelain 0), reinstall=replaced.
- [ ] F3 — plugin 40-prompt-racikan + golden parity
- [ ] F4 — gate penuh + dokumentasi + push

## F1 — Inventaris transform (diff fork-ref/prompt.js vs vanilla/prompt.js)

Diff = 166→201 baris. Inventaris COCOK daftar brief (T1–T8). Semua OLD/anchor
STATIS di prompt render vanilla (tak ada `${}` interpolasi di dalam string
anchor) — verifikasi baca source. Vonis per item:

**T1 racikanRules(role)** — helper fork prompt.js:22-38 (port VERBATIM). Injeksi
di 3 tempat: manager (T1a), screener (T1b, lewat T-insert sebelum NARRATIVE
QUALITY), general (T8). `config.promptNotes?.[role] ?? []` → notes kosong =
"" (prompt pabrik murni).

**T2** GANTI (screener) — OLD `Your job: pick the highest-conviction candidate
and call deploy_position. active_bin is pre-fetched.` → NEW `Your job: deploy
only when at least one candidate has real conviction. active_bin is
pre-fetched.` (fork:127)

**T3** GANTI (screener) — OLD `- top10 > 60% → concentrated, risky` → NEW
`- top10 > ${config.screening.maxTop10Pct}% → concentrated, risky` (fork:136;
maxTop10Pct ADA vanilla config.js:95 default 60)

**T4** SISIP (screener) — setelah OLD `- no narrative + no smart wallets → skip\n`
sisip baris fork:139 `- If only one candidate is returned, do not deploy by
default. Treat it as "maybe nothing is good enough"; deploy only if it still
has a strong narrative, smart-wallet confirmation, and clean pool metrics.\n`

**T1b** SISIP (screener) — sebelum anchor `NARRATIVE QUALITY (your main judgment
call):` prepend `${racikanRules("screener")}` (fork:150)

**T5** GANTI blok 4-baris (screener DEPLOY RULES, COMPOUNDING TETAP) —
OLD (vanilla:123-126):
```
- bins_below = round(config.strategy.minBinsBelow + (candidate volatility/5)*(config.strategy.maxBinsBelow-config.strategy.minBinsBelow)) clamped to [minBinsBelow,maxBinsBelow]. Volatility must be a positive number; 0/unknown means skip.
- Use amount_y only, keep amount_x=0 and bins_above=0.
- Bin steps must be [80-125].
- Pick ONE pool only when conviction is real. If only one weak candidate survives, skip and explain why none qualify.
```
NEW (fork:151-155, port VERBATIM, interpolasi): strategyLock-ternary +
`bins_below = round(${minBinsBelow} + (candidate volatility/5)*${maxBinsBelow-minBinsBelow}) clamped to [${minBinsBelow},${maxBinsBelow}]. bins_above = 0.` +
`Bin steps must be [${minBinStep}-${maxBinStep}].` +
`Pick ONE pool only if it qualifies. Otherwise explain why none qualify.`
(fork DROP baris "Use amount_y only", TAMBAH baris strategyLock. Field
strategyLock/minBinStep/maxBinStep ABSEN vanilla config → fixture golden isi;
runtime degrade `?? "default"` / config default 80/125.)

**T6** SISIP convictionHint (screener, gated `config.experiments?.convictionSizing`)
— sesudah `...Otherwise explain why none qualify.\n\n`, sebelum weights/lessons/
Timestamp. Nilai fork:120-123 (port VERBATIM). OFF (default) → tak emit
(parity: fork juga null). ON → `${convictionHint}\n\n`.

**T7** SISIP INTENT DISAMBIGUATION (general SAJA) — anchor `The user's
instruction IS the confirmation.\n\n` → sisip blok 4-baris fork:179-182.
CATATAN: brief bilang "manager/general" TAPI anchor "instruction IS the
confirmation." HANYA ada di general (else) block; manager pakai early-return
lean prompt (vanilla:17-33, tanpa frasa itu). Diff fork = 1 insert saja
(149a179), general-only. Bukan STOP (cocok fork persis); prose brief longgar.

**T8** SISIP racikanRules("general") (general) — anchor `unless the current
candidate is clearly stronger.\n\n` → NEW +`${racikanRules("general")}\n`.
Fork TAMBAH blank line (diff 162c196,197) → notes kosong pun fork emit 1 `\n`
ekstra (`stronger.\n\n\nTimestamp`) beda dari vanilla (`stronger.\n\nTimestamp`).
Plugin HARUS replikasi (T8 selalu jalan di general, bukan gated notes).

## Struktur penting

- MANAGER: early-return lean prompt vanilla:17-33 (BEHAVIORAL CORE). racikanRules
  ("manager") sisip di tail-nya: anchor `Guidelines are heuristics.\n\n` →
  +`${racikanRules("manager")}` (fork:50). Notes kosong = identik vanilla.
- `else if (agentType === "MANAGER")` block bawah (basePrompt +=, "Your goal:
  Manage positions...") = DEAD CODE di vanilla+fork (early-return sudah nangkap
  MANAGER). Tak disentuh.
- Plugin kerja pada STRING RENDER (bukan template). Semua anchor terverifikasi
  statis di render vanilla.

## DEFER (utang → 6.4/6.5)

- timeProfile: `getTimeProfileForPrompt()` (fork lessons.js:1123) ABSEN vanilla
  lessons. Fork screener tail unconditional. → 6.4/6.5.
- narrativeProfile: `getNarrativeProfileForPrompt()` (fork lessons.js:1215),
  gated `config.experiments?.narrativeProfileSignal`. ABSEN vanilla. → 6.4/6.5.
- Golden parity: set fixture narrativeProfileSignal=false + data lessons kosong
  (timeProfile→null) + normalisasi buang Timestamp & blok time/narrative dari
  output fork sebelum banding.

## Config fields fork-only (degrade-safe vanilla via ??/optional-chaining)

strategy.strategyLock (fork config:269), experiments.{convictionSizing:436,
convictionSizingMaxAdjustPct:437, narrativeProfileSignal:425}, promptNotes:118,
activeSetup. Fixture golden isi semua (nilai jelas-dummy, bukan realistis-live).

## Hook API (lib/hooks.js) + KEPUTUSAN AKSES (deviasi terjustifikasi dari sketsa brief)

`emitSync(event, ctx)` → jalankan handler sinkron, return ctx termutasi. hooks.js
module singleton (ESM) → registry Map dibagi semua importer.

TEMUAN: `__zenpackHooks` yang ditanam patch 01 = binding MODULE-LOCAL index.js
(import namespace baris atas index.js). BUKAN di globalThis. Grep `globalThis`
di seluruh pack = NOL. Patch 03b pakai bare `__zenpackHooks` karena 03b ada DI
index.js (modul sama). Tapi patch 05 sasar agent.js = MODUL BEDA → bare
`__zenpackHooks` out-of-scope, dan `globalThis.__zenpackHooks` (sketsa brief) =
undefined → hook MATI, transform tak pernah jalan.

KEPUTUSAN (brief F2 suruh "cek pola akses & samakan"): call site agent.js:173
ada DI FUNGSI async, dan idiom sekitar (agent.js:168-170) sudah pakai
`await import("./signal-weights.js")` / `await import("./config.js")`. Maka
patch 05 = 1 titik replaceLine, NEW pakai dynamic import (bukan globalThis):
```
let systemPrompt = buildSystemPrompt(...args sama...);
try {
  const { emitSync } = await import("./zenpack-lib/hooks.js");
  const __c = emitSync("prompt:build", { agentType, prompt: systemPrompt });
  if (typeof __c?.prompt === "string") systemPrompt = __c.prompt;
} catch { /* zen-pack prompt hook absent */ }
```
`await import("./zenpack-lib/hooks.js")` = registry singleton yang SAMA dengan
tempat plugin register → handler kena. Degrade-safe: kalau hooks.js absen
(mis. pack ter-uninstall tapi patch tertinggal — mustahil normal) → import
throw → catch → systemPrompt utuh (perilaku vanilla). Tetap "1 titik" (satu
replaceLine, tanpa inject import terpisah), idiom cocok kode sekitar.
FLAG owner di gate F2: ganti globalThis→dynamic-import. Bisa di-veto.
