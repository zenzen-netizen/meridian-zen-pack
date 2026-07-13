# Fase 5.4-RECON — agentLoop: kedalaman jalinan 6 blok custom fork

Recon-only. Nol patch. Bukti file:line aktual.

**Sumber:**
- Fork (experimental, acuan primer perilaku): `meridian-lab/fork-ref/agent.js` (536 baris)
- Vanilla acuan (main, target pack): `meridian-lab/vanilla-test/agent.js` (417 baris)
- Call-site target: `meridian-lab/vanilla-test/index.js` (BELUM diport)

---

## Tabel 6 blok

| Blok | Lokasi (fork line) | Jenis | Kedalaman | Cara-1 feasible? |
|---|---|---|---|---|
| **1. fallbackClient** | decl L119–125 (top); `useFallbackForModel`+`activeClient` L271–275 (in-body); failover elif L323–328 (in-body) | top-level + 2× in-body | Sedang. In-body jalin var lokal loop: `activeClient`, `usedModel`, `model`, `fallbackClient`, `attempt`, `errCode`. Failover elif sisip di tengah blok error-code 502/503/529 vanilla | Ya tapi rapuh: 1 top append bersih + 2 anchor in-body di tengah retry-loop |
| **2. salvage tool-dump** | `parseContentToolCalls`+3 Set L148–180 (top); counters L252–256 (in-body decl); salvage L366–384 (in-body); reject-dump-final L398–416 (in-body) | top-level + 3× in-body | Dalam. Salvage jalin: `msg`, `contentSalvageCount`, `step`, `MAX_CONTENT_SALVAGE`, `NO_SALVAGE_TOOLS`. Reject-dump jalin: `msg.content`, `toolDumpRetryCount`, `messages`, `providerMode`, `allowNoToolFinal` (overlap blok 6), `goal` | top-level: ya bersih. In-body: 3 sisipan, reject-dump paling dalam |
| **3. dedup tool call** | `runToolCall` closure L446–495 + `execCache` Promise.all L502–511 | in-body STRUKTURAL | Paling dalam. Ganti STRUKTUR blok eksekusi tool. Jalin: `msg.tool_calls`, `firedOnce`, `ONCE_PER_SESSION`, `NO_RETRY_TOOLS`, `step`, `onToolStart/Finish`, callback signature, + kopel ke arg-repair upstream (vanilla pakai `invalidToolArgErrors` Map L259/272-274 yang fork BUANG) | Ya via replaceLine blok utuh — TAPI titik paling menentukan & paling rapuh. Lihat #3 bawah |
| **4. CHAT_CONFIRM_TOOLS** | `CHAT_CONFIRM_TOOLS` Set L21 (top); pemakaian L470–477 (in-body, DI DALAM runToolCall) | top-level + 1× in-body | Dalam-nested. Pemakaian bersarang di dalam `runToolCall` (blok 3). Jalin: `interactive`, `onConfirmRequired` (signature), `functionName`, `functionArgs`, `onToolFinish`, `step` | Top Set: ya. Pemakaian: TIDAK berdiri sendiri — nempel di badan blok 3. Praktis 1 paket dgn blok 3 |
| **5. recordLlmCost** | import L107 (top); `usage:{include:true}` L288 (in-body); call L293–296 (in-body) | top-level import + 2× in-body | Dangkal. Jalin ringan: `response.usage`, `agentType`, `usedModel`. Berdiri sendiri, try/catch fail-open. **Butuh modul `llm-cost-tracker.js` (TAK ADA di vanilla-test; ada di zen-pack/plugins)** | Ya, paling bersih dari yang in-body. 1 param add + 1 blok call. Tapi kopel dep modul |
| **6. generalMaxTokens + allowNoToolFinal** | signature options L223 (sig); max_tokens ternary L287 (in-body); allowNoToolFinal L404–405 (overlap blok 2) + guard L417–421 (in-body) | signature + in-body | Sedang, tersebar. `generalMaxTokens` butuh `config.llm.generalMaxTokens` (**TAK ADA di vanilla-test/config.js**; fork default 8192). `allowNoToolFinal` default false = inert. Guard L421 ubah `if (mustUseRealTool && !sawToolCall)` +`&& !allowNoToolFinal` | Ya tapi kopel: config.js + call-site. Kandidat DEFER |

---

## Jawaban 6 pertanyaan kunci

### 1. Berapa titik patch kalau Cara 1?
**~13–14 titik total.**

Top-level (4, mudah, append verbatim):
- T1 fallbackClient decl (blok 1)
- T2 parseContentToolCalls + 3 Set (blok 2)
- T3 CHAT_CONFIRM_TOOLS Set (blok 4)
- T4 recordLlmCost import (blok 5)

In-body + signature (9–10, rapuh):
- P1 signature options destructure L223 (blok 4+6)
- P2 salvage counters decl L252–256 (blok 2)
- P3 max_tokens ternary L287 + `usage:{include:true}` L288 (blok 5+6) — 1–2 titik
- P4 recordLlmCost call L293–296 (blok 5)
- P5 useFallbackForModel+activeClient L271–275 (blok 1)
- P6 failover elif L323–328 (blok 1)
- P7 salvage block L366–384 (blok 2)
- P8 reject-dump-final L398–416 (blok 2+6 overlap)
- P9 allowNoToolFinal guard mod L417–421 (blok 6)
- P10 Promise.all→runToolCall+execCache L446–511 STRUKTURAL (blok 3, memuat blok 4 pemakaian)

### 2. Top-level (mudah, nol risiko update) vs in-body (rapuh)?
- **Top-level: 4** — semua additive verbatim, bisa plugin/append, nol risiko saat update yunus.
- **In-body/signature: 9–10** — rapuh, anchor di tengah badan `agentLoop`; tiap update fungsi ini dari yunus berpotensi geser anchor.
- **Rasio ~30% top-level : 70% in-body.** Mayoritas beban ada di badan fungsi.

### 3. Refactor Promise.all→runToolCall (blok 3) — VERDICT
**Bisa replaceLine blok utuh, TAPI ini titik paling rapuh & TIDAK murni self-contained.**

- OLD (vanilla): `const toolResults = await Promise.all(msg.tool_calls.map(async (toolCall) => {` … `}));` = **vanilla L315–392, ~78 baris.**
- NEW (fork): `runToolCall` closure L446–495 + `execCache` Promise.all L502–511 = **~66 baris.**
- Baris pembuka `await Promise.all(msg.tool_calls.map(async (toolCall) => {` **UNIK** di file → anchor replaceLine layak.
- **Masalah kopel:** vanilla blok ini pakai `invalidToolArgErrors` Map (decl vanilla L259, isi L272–274, konsumsi L319–331). Fork **membuang** map itu total. Kalau cuma ganti blok Promise.all tanpa sentuh arg-repair upstream → `invalidToolArgErrors` jadi dead code (di-set, tak dipakai) = harmless tapi kotor. Port bersih WAJIB juga edit blok arg-repair upstream (vanilla L259–279 → fork L345–363).
- **Kesimpulan:** blok 3 = 1 replaceLine besar (78→66 baris) + 1 edit upstream arg-repair. 2 titik terkopel, struktural. Ini yang paling condong ke **Cara 2** kalau dinilai sendiri.

### 4. Overlap blok 2 & 6 (allowNoToolFinal di reject-dump path) — 1 atau 2 patch?
**1 patch.** Reject-dump-final block (fork L398–416) disisip verbatim sebagai satu kesatuan; ternary `allowNoToolFinal` (L404–405) sudah ADA di dalam blok itu. Jadi P8 = 1 sisipan yang otomatis bawa bagian blok 6. Sisa blok 6 yang independen: P1 signature + P3 max_tokens + P9 guard.

### 5. Signature agentLoop: vanilla vs fork + status call-site
- **Beda +2 param di `options`:** vanilla L158 `{ interactive, onToolStart, onToolFinish }` → fork L223 tambah `onConfirmRequired, allowNoToolFinal`. Keduanya ada default (null / false).
- **Call-site FORK (index.js) SUDAH wire:** `allowNoToolFinal: true` fork/index.js L1103 (screening cron), `onConfirmRequired: requestConfirmation` fork L3488 (telegram path).
- **Call-site TARGET (vanilla-test/index.js) BELUM diport:** 8 pemanggil `agentLoop(`; yang telegram (L1658) cuma kirim `{ interactive, onToolStart, onToolFinish }`. NOL kirim `onConfirmRequired`/`allowNoToolFinal`.
- **Implikasi:** kalau signature + cabang in-body diport SEKARANG dgn call-site belum diport → jadi **kode tidur** (`allowNoToolFinal` selalu false, `onConfirmRequired` selalu null). Karena default inert & aman (perilaku = vanilla), porting dini = additive dorman HARMLESS, bukan breaking. Tapi sesuai pola Stage 4: **kandidat DEFER ke Stage 7 bareng port call-site index.js.**

### 6. Rekomendasi Claude Code — HYBRID
Bukan Cara 1 murni, bukan Cara 2 murni. Bagi 6 blok per kopel-dep:

**Gelombang A — port SEKARANG (5.4), top-level via plugin/append + in-body dangkal mandiri:**
- Blok 1 fallbackClient — 1 top append + 2 anchor in-body. Berdiri sendiri, tak butuh call-site/config baru. Nilai langsung (failover reliability). Env-gated (`LLM_FALLBACK_BASE_URL`), off = vanilla.
- Blok 2 salvage tool-dump — top-level parseContentToolCalls bersih; in-body salvage + reject-dump. Fungsional tanpa call-site baru (kecuali cabang allowNoToolFinal di reject-dump yang inert saat false). Nilai anti-halusinasi langsung.
- Blok 5 recordLlmCost — paling bersih, TAPI ship modul `llm-cost-tracker.js` (dari zen-pack/plugins) lebih dulu. Fail-open.

**Gelombang B — DEFER ke Stage 7 (bareng port call-site index.js + config.js):**
- Blok 4 CHAT_CONFIRM_TOOLS — pemakaian bersarang di runToolCall (blok 3) DAN butuh `onConfirmRequired` dari call-site telegram (belum diport). Port terpisah = kode tidur.
- Blok 6 generalMaxTokens+allowNoToolFinal — butuh `config.llm.generalMaxTokens` (belum ada di vanilla-test/config.js) + call-site `allowNoToolFinal:true` (screening cron belum diport). Port dini = risiko `undefined` max_tokens utk GENERAL.

**Blok 3 dedup tool call — KEPUTUSAN TERPISAH (Zen+Claude):**
- Paling struktural & rapuh. Memuat pemakaian blok 4. Kalau blok 4 DEFER, blok 3 bisa diport TANPA baris CHAT_CONFIRM (runToolCall minus L470–477) di Gelombang A, lalu L470–477 disisip di Stage 7 saat onConfirmRequired hidup.
- Alternatif: DEFER blok 3 penuh ke Stage 7 bareng blok 4 (satu bedah struktural sekaligus, hindari 2× sentuh badan eksekusi).
- **Saran:** DEFER blok 3 penuh ke Stage 7. Alasan: (a) ini satu-satunya perubahan STRUKTUR (bukan additive) → paling rentan konflik update yunus; (b) memuat blok 4 yang sudah DEFER; (c) kopel ke arg-repair upstream. Digabung sekali bedah lebih kokoh daripada dicungkil separuh sekarang.

**Angka penentu:** 4 top-level (aman) + 9–10 in-body. Dari 10 in-body, ~5 kopel ke call-site/config/modul yang belum diport (blok 3,4,6). Jadi hanya ~4–5 in-body (blok 1,2,5) yang benar-benar siap tanpa dependensi → itulah Gelombang A.

---

## Prinsip / catatan
- `jsonrepair` sudah diimport di vanilla-test/agent.js L2 → parseContentToolCalls (blok 2) tak butuh import baru.
- `llm-cost-tracker.js` TIDAK ada di vanilla-test; ADA di `zen-pack/plugins/llm-cost-tracker.js` → ship modul dulu utk blok 5.
- `config.llm.generalMaxTokens` TIDAK ada di vanilla-test/config.js (fork default 8192) → blok 6 butuh config port.
- Tidak ada blok UNKNOWN — 6 blok terpetakan jelas dari diff fork vs vanilla.
- Bot live NOL disentuh. Nol patch/plugin/test ditulis fase ini.
