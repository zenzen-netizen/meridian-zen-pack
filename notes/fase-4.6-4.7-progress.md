# FASE 4.6 + 4.7 — strategy-library auto-seed + token-blacklist fail-open

Basis vanilla = main @ 5ab14b4. Target tiap patch: samakan perilaku
vanilla-main → fork (perilaku fork = yunus-experimental 1f3fc82).
Routing paths sudah patch 02 — JANGAN sentuh.

## ✅ F1 — RECON KONFIRMASI (read-only)
Sandbox: vanilla=/home/ubuntu/meridian-lab/vanilla @ 5ab14b4, fork-ref idem.

strategy-library.js (vanilla):
- L29 `const DEFAULT_STRATEGIES = {` (definisi)
- L95 `function ensureDefaultStrategies() {` (definisi)
- L115 `ensureDefaultStrategies();` ← PEMANGGILAN top-level (unik, count=1)
Fork: grep ensureDefaultStrategies = KOSONG (blok dihapus total). ✓

token-blacklist.js (vanilla) load() catch L18–21:
```
  } catch (error) {
    log("blacklist_error", `Invalid ${BLACKLIST_FILE}: ${error.message}`);
    throw new Error(`Safety blacklist is unreadable: ${BLACKLIST_FILE}`);
  }
```
= FAIL-CLOSED. Fork L19–21 `} catch { return {}; }` = FAIL-OPEN. ✓

Vonis: 0 deviasi dari konteks. Lanjut.

## Patcher (F3 gate)
lib/patcher.js replaceLine = `src.replace(oldLine,newLine)` exact-substring,
MULTILINE-SAFE. Idempotent `src.includes(newLine)`, unik via split-count.
→ Blok catch multi-baris = 1 replaceLine (old=blok utuh). PATCHER TAK PERLU
DI-EXTEND. Item format `{file,marker,replaces:[{old,new}]}` (no anchor) =
cuma jalan replaceLine path di apply.mjs.

## ⬜ F2 — patch 06-strategy-no-autoseed
## ⬜ F3 — patch 07-blacklist-failopen
## ⬜ F4 — gate penuh + dok
