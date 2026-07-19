# Stage 8.0 — basis, transport, and PRA-8 lock

Owner lock: **2026-07-19**.

## Decisions

1. **Basis stays `main@5ab14b4`.** A disposable replay against
   `experimental@1f3fc82` failed: the histories diverge by 99/186 commits from
   their merge-base, 18 upstream-changed files overlap pack patch targets, 14
   patch operations reported `old-not-found`, and Patch 31 rolled back a syntax
   failure caused by duplicate `setLatestCandidates`. Treating experimental as
   a newer drop-in basis would require a new extraction, not an anchor refresh.
2. **`tools/study.js` keeps vanilla `agent-meridian.js` routing.** The fork's
   direct-fetch variant is permanently dropped. The shared transport already
   owns base-URL normalization, headers, response parsing, structured errors,
   timeout, and optional retry for study and other runtime consumers. The fork
   variant duplicates that path and falls back to a hardcoded public API key;
   shipping a credential-like fallback in source creates rotation, disclosure,
   and configuration-bypass liability without adding study behavior.
3. **PRA-8 executor block 1 runs now, before Stage 8.1.** It remains one coupled
   money-adjacent workstream: GMGN split persistence, executor paths Batch-2,
   flat tool schema, validation/redaction/migration, and removal of Plugin 60's
   GMGN edit gate. No partial port is allowed.

## Boundary

- Release identity remains `v1.0.0-yunus-5ab14b4`.
- No live bot was touched or restarted during 8.0.
- The disposable experimental audit was removed after evidence capture.
- PRA-8 implementation is blocked on its dedicated recon checkpoint.
