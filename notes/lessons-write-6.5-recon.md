# Recon 6.5 — lessons.js write layer

Perbandingan ini memakai vanilla committed `5ab14b4:lessons.js`, sandbox
post-6.4, dan sumber kebenaran `git show 643e954:lessons.js`. Baris fork adalah
recon owner; kecocokan ditentukan oleh konten exact.

## W0 — binding/dependensi

- `isPaperMode`, `config`, `config.activeSetup`, `wibHour`, `sessionForHour`, dan
  `keepActiveRacikan` sudah hidup di rumah Patch 04a/21. Tidak perlu import
  top-level baru untuk binding tersebut.
- W1 memakai primitive fork `ICON`, `SEP`, `tree`, dan `header`; sandbox belum
  mengimpor keempatnya. Patch 25a harus menambah import fork exact dari
  `./views/format.js`.
- `reloadScreeningThresholds` tetap dynamic import seperti fork; `config`
  memakai binding Patch 04a/21.

## W1 — recordPerformance suspect + tagging/quarantine

OLD exact yang berubah:

```js
  const closeReasonText = String(perf.close_reason || "").toLowerCase();
  const suspiciousAbsurdClosedPnl =
    Number.isFinite(pnl_pct) &&
    perf.initial_value_usd >= 20 &&
    pnl_pct <= -90 &&
    !closeReasonText.includes("stop loss");

  if (suspiciousAbsurdClosedPnl) {
    log("lessons_warn", `Skipped absurd closed PnL record for ${perf.pool_name || perf.pool}: pnl_pct=${pnl_pct.toFixed(2)} reason=${perf.close_reason}`);
    return;
  }

  const signalSnapshot = buildSignalSnapshot(perf);
  const entry = {
    ...perf,
    signal_snapshot: signalSnapshot,
    pnl_usd: Math.round(pnl_usd * 100) / 100,
    pnl_pct: Math.round(pnl_pct * 100) / 100,
    range_efficiency: Math.round(range_efficiency * 10) / 10,
    recorded_at: new Date().toISOString(),
  };

  data.performance.push(entry);

  // Derive and store a lesson
  const lesson = derivLesson(entry);
  if (lesson) {
    data.lessons.push(lesson);
    log("lessons", `New lesson: ${lesson.rule}`);
  }

  save(data);
  if (lesson) {
    void pushHiveLesson(lesson);
  }

  // Update pool-level memory
  if (perf.pool) {
```

NEW exact yang berubah:

```js
  // A ≤−90% close on a ≥$20 position that was NOT a stop-loss is ambiguous: it
  // could be a genuine ≥90% rug OR a bad-data artifact (e.g. a mis-scaled / not-yet-
  // settled PnL reading). We used to DROP it silently here — which meant a real rug
  // could vanish without a trace. Now we never drop it: the record is kept but FLAGGED
  // `suspect_pnl` so it is quarantined from auto-learning + user-facing stats until an
  // operator verifies it (see the `!suspect_pnl` filters downstream). An alert fires too.
  const closeReasonText = String(perf.close_reason || "").toLowerCase();
  const suspiciousAbsurdClosedPnl =
    Number.isFinite(pnl_pct) &&
    perf.initial_value_usd >= 20 &&
    pnl_pct <= -90 &&
    !closeReasonText.includes("stop loss");

  const suspectReason = suspiciousAbsurdClosedPnl
    ? "≤-90% non-stopLoss, verifikasi rug vs bad-data"
    : null;
  if (suspiciousAbsurdClosedPnl) {
    log("lessons_warn", `SUSPECT closed PnL recorded (NOT dropped) for ${perf.pool_name || perf.pool}: pnl_pct=${pnl_pct.toFixed(2)} reason=${perf.close_reason} — quarantined from auto-learning/stats until verified (rug asli vs bad-data)`);
    // Alert the operator so a flagged close gets eyes-on (rug asli vs bad-data).
    // Fire-and-forget + fail-open: a Telegram hiccup must never block recording.
    void (async () => {
      try {
        const { sendMessage, isEnabled } = await import("./telegram.js");
        if (!isEnabled()) return;
        await sendMessage([
          header(ICON.warn, "SUSPECT close", `${pnl_pct.toFixed(1)}% (non-stopLoss)`),
          SEP,
          tree([
            `Pool: ${perf.pool_name || perf.pool || "?"}`,
            `Alasan close: ${perf.close_reason || "?"}`,
            `Cek: rug asli vs bad-data`,
            `Dikarantina dari auto-learning + stats sampai diverifikasi`,
          ]),
        ].join("\n"));
      } catch (e) {
        log("lessons_warn", `Suspect-PnL alert failed (fail-open): ${e.message}`);
      }
    })();
  }

  const signalSnapshot = buildSignalSnapshot(perf);
  const recordedAt = new Date().toISOString();
  const openedAt = perf.deployed_at || null;
  const openHourWib = wibHour(openedAt);
  const entry = {
    ...perf,
    signal_snapshot: signalSnapshot,
    pnl_usd: Math.round(pnl_usd * 100) / 100,
    pnl_pct: Math.round(pnl_pct * 100) / 100,
    range_efficiency: Math.round(range_efficiency * 10) / 10,
    opened_at: openedAt,
    closed_at: recordedAt,
    open_hour_wib: openHourWib,
    open_session: openHourWib != null ? sessionForHour(openHourWib).key : null,
    recorded_at: recordedAt,
    // Quarantine flag for an absurd (≤−90% non-stopLoss) close — see gate above.
    // Persisted on the record so every downstream consumer can exclude it (like `paper`).
    ...(suspiciousAbsurdClosedPnl ? { suspect_pnl: true, suspect_reason: suspectReason } : {}),
  };

  data.performance.push(entry);

  // Derive and store a lesson. Paper (sim) AND suspect lessons are TAGGED so live
  // consumers can exclude them (getLessonsForPrompt) — and neither is ever pushed to
  // the shared hive (a suspect close is unverified data; don't broadcast it).
  const lesson = derivLesson(entry);
  if (lesson) {
    if (entry.paper) lesson.paper = true;
    if (entry.suspect_pnl) lesson.suspect = true;
    data.lessons.push(lesson);
    log("lessons", `New lesson${entry.paper ? " [paper]" : ""}${entry.suspect_pnl ? " [suspect]" : ""}: ${lesson.rule}`);
  }

  save(data);
  if (lesson && !entry.paper && !entry.suspect_pnl) {
    void pushHiveLesson(lesson);
  }

  // Update pool-level memory — LIVE, non-suspect closes only. Paper outcomes never
  // touch pool-memory.json (so they can't bias live screening once you flip to live),
  // and a suspect (unverified ≤−90%) close is quarantined the same way.
  // (return lesson so callers can include it in close notifications)
  if (perf.pool && !entry.paper && !entry.suspect_pnl) {
```

Tail OLD → NEW exact:

```diff
-  void pushHivePerformanceEvent({
-    ...entry,
-    base_mint: perf.base_mint || null,
-    fees_earned_sol: perf.fees_earned_sol || 0,
-    eventId: `close:${perf.position}:${entry.recorded_at}`,
-  });
+  // Sim AND suspect closes are never broadcast to the shared hive (would contaminate
+  // other bots — paper is sim data, suspect is unverified ≤−90% data).
+  if (!entry.paper && !entry.suspect_pnl) {
+    void pushHivePerformanceEvent({
+      ...entry,
+      base_mint: perf.base_mint || null,
+      fees_earned_sol: perf.fees_earned_sol || 0,
+      eventId: `close:${perf.position}:${entry.recorded_at}`,
+    });
+  }
 
+  return lesson || null;
 }
```

## W2 — evolve 5 close LIVE-only

OLD exact:

```js
  // Evolve thresholds every 5 closed positions
  if (data.performance.length % MIN_EVOLVE_POSITIONS === 0) {
    const { config, reloadScreeningThresholds } = await import("./config.js");
    const result = evolveThresholds(data.performance, config);
    if (result?.changes && Object.keys(result.changes).length > 0) {
      reloadScreeningThresholds();
      log("evolve", `Auto-evolved thresholds: ${JSON.stringify(result.changes)}`);
    }

    // Darwinian signal weight recalculation
    if (config.darwin?.enabled) {
      const { recalculateWeights } = await import("./signal-weights.js");
      const wResult = recalculateWeights(data.performance, config);
      if (wResult.changes.length > 0) {
        log("evolve", `Darwin: adjusted ${wResult.changes.length} signal weight(s)`);
      }
    }
  }
```

NEW exact:

```js
  // Evolve thresholds every 5 closed positions — LIVE records only. Sim (paper)
  // closes never move real screening thresholds or Darwinian signal weights, even
  // if this box is later flipped to live with paper history still on file.
  // LIVE records of the ACTIVE racikan only — paper closes never move real
  // thresholds/Darwin weights, and a different racikan's records are isolated out
  // (keepActiveRacikan) so each racikan evolves on its own trades. Suspect
  // (unverified ≤−90%) closes are also excluded so bad-data can't steer evolution.
  const livePerf = data.performance.filter((p) => !p.paper && !p.suspect_pnl && keepActiveRacikan(p));
  if (livePerf.length > 0 && livePerf.length % MIN_EVOLVE_POSITIONS === 0) {
    // Auto-evolve threshold writer — gated by config.learning.evolveEnabled (FREEZE
    // baseline). false = FROZEN: skip the auto-write entirely (no user-config write, no
    // threshold change). Only the AUTO trigger is gated here — the manual /evolve
    // (index.js REPL) stays callable so the operator can still override on demand.
    // Darwin (signal weights, below) is INDEPENDENT — it keeps its own darwinEnabled toggle.
    if (config.learning?.evolveEnabled === false) {
      log("evolve", `Auto-evolve frozen (evolveEnabled=false) at ${livePerf.length} closes — thresholds unchanged`);
    } else {
      const { reloadScreeningThresholds } = await import("./config.js");
      const result = evolveThresholds(livePerf, config);
      if (result?.changes && Object.keys(result.changes).length > 0) {
        reloadScreeningThresholds();
        log("evolve", `Auto-evolved thresholds: ${JSON.stringify(result.changes)}`);
      }
    }

    // Darwinian signal weight recalculation
    if (config.darwin?.enabled) {
      const { recalculateWeights } = await import("./signal-weights.js");
      const wResult = recalculateWeights(livePerf, config);
      if (wResult.changes.length > 0) {
        log("evolve", `Darwin: adjusted ${wResult.changes.length} signal weight(s)`);
      }
    }
  }
```

Konsumen dan jalur file:line:

- Auto: sandbox `lessons.js:108 recordPerformance` → `:198` trigger lama →
  `:344 evolveThresholds`; fork `lessons.js:156` → `:298 livePerf` → `:309`
  `evolveThresholds(livePerf, config)` → `:458` chokepoint.
- Darwin fork: `lessons.js:298 livePerf` → `:319`
  `recalculateWeights(livePerf, config)`.
- Manual tetap raw: sandbox `cli.js:570` dan `index.js:2014` memanggil
  `evolveThresholds`; W3 memfilter lagi di chokepoint.

## W3 — isolasi active-racikan di chokepoint

OLD → NEW exact:

```diff
 export function evolveThresholds(perfData, config) {
+  // Active-racikan isolation at the chokepoint: BOTH the auto-loop (livePerf,
+  // already filtered) and the manual /evolve (raw performance[]) only ever tune
+  // on the current racikan's trades. Future-proof — no hardcoded racikan name.
+  perfData = (perfData || []).filter(keepActiveRacikan);
   if (!perfData || perfData.length < MIN_EVOLVE_POSITIONS) return null;

-  // ── 1. minFeeActiveTvlRatio ────────────────────────────────────
+  // ── 1. minFeeActiveTvlRatio ───────────────────────────────────

-  if (changes.minOrganic       != null) s.minOrganic       = changes.minOrganic;
+  if (changes.minOrganic           != null) s.minOrganic           = changes.minOrganic;
```

## W4 — hapus helper percentile mati

OLD exact (unik satu kali):

```js
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

```

NEW exact adalah penghapusan kosong. Fork masih memakai `avg()` pada dua call
(`lessons.js:523-524`) tetapi tidak memiliki deklarasi/pemakaian `percentile` di
file mana pun. Jadi delapan baris itu tidak dipindah atau diganti: fork membuang
dead code. Implementasi memakai exact replace menjadi marker kosong agar mesin
`replaceLine` tetap idempotent; kode helper benar-benar hilang dan uninstall
tetap backup/restore. Pola OLD count=1, sehingga tidak berisiko/ambigu.

## W5 — dedup addLesson

OLD → NEW exact setelah `const data = load();`:

```diff
   const data = load();
+
+  // Dedup: an identical rule already on file is pure noise. This guards against
+  // the model firing update_config (or any addLesson source) repeatedly with the
+  // same change — which historically stacked the same lesson 60+ times. Refresh
+  // the existing lesson's recency instead so it still injects, then bail.
+  const existing = data.lessons.find((l) => l.rule === safeRule);
+  if (existing) {
+    existing.created_at = new Date().toISOString();
+    if (pinned) existing.pinned = true;
+    save(data);
+    log("lessons", `Duplicate lesson skipped (refreshed recency): ${safeRule.slice(0, 60)}`);
+    return;
+  }
+
   const lesson = {
```

## W6 — writer removeLesson

OLD exact adalah junction langsung dari akhir `listLessons` ke komentar keyword:

```js
}

/**
 * Remove lessons matching a keyword in their rule text (case-insensitive).
 */
```

NEW exact:

```js
}

/**
 * Remove a lesson by ID.
 */
export function removeLesson(id) {
  const data = load();
  const before = data.lessons.length;
  data.lessons = data.lessons.filter((l) => l.id !== id);
  save(data);
  return before - data.lessons.length;
}

/**
 * Remove lessons matching a keyword in their rule text (case-insensitive).
 */
```

## W7 — paper/suspect filter prompt

OLD exact:

```js
  const data = load();
  if (data.lessons.length === 0) return null;
```

NEW exact:

```js
  const data = load();
  // Sim (paper) lessons: shown while dry-running (it's the whole dataset), but
  // EXCLUDED from the live prompt unless opted in via usePaperHistoryWhenLive.
  // When the opt-in is on they're kept but flagged 🧪 in fmt() so the model treats
  // them as low-credibility soft reference — never as live, mechanical truth.
  if (!isPaperMode() && !config.experiments?.usePaperHistoryWhenLive) {
    data.lessons = data.lessons.filter((l) => !l.paper);
  }
  // Suspect (unverified ≤−90%) lessons never enter the prompt, in either mode — a
  // bad-data artifact must not steer the agent until the operator verifies it.
  data.lessons = data.lessons.filter((l) => !l.suspect);
  if (data.lessons.length === 0) return null;
```

## W8 — marker lesson sim

OLD → NEW exact:

```diff
     const pin  = l.pinned ? "📌 " : "";
-    return `${pin}[${l.outcome.toUpperCase()}] [${date}] ${l.rule}`;
+    const sim  = l.paper ? "🧪 " : "";  // sim/paper-derived → low-credibility soft reference
+    return `${pin}${sim}[${l.outcome.toUpperCase()}] [${date}] ${l.rule}`;
```

## Verdict STOP

Tidak ada temuan absen/ambigu. W1–W8 dapat dipasang verbatim melalui Patch
25a–c; W4 aman sebagai exact replacement, bukan inject.
