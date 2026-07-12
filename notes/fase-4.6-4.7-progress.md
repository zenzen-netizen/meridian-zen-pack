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

## ✅ F2 — patch 06-strategy-no-autoseed
core-patches/06 (1 replaceLine, call→comment). Apply vanilla-test: replaced,
node --check OK. Bukti: modul load data-dir isolasi → strategy-library.json
TAK tercipta, active null (auto-seed mati = fork). Commit e095bd2.

## ✅ F3 — patch 07-blacklist-failopen
core-patches/07 (1 replaceLine blok catch multi-baris; patcher TAK di-extend —
replaceLine = exact-substring src.replace, multiline-safe). Apply: replaced,
blok = fork verbatim, node --check OK. Bukti: blacklist korup "{bad json" →
isBlacklisted() = false, NO throw (fail-open = fork). Commit 2bfdbd1.

## ✅ F4 — gate penuh + dok
Siklus penuh vanilla-test (pristine 5ab14b4): install (06+07 replaced) → boot
5 plugins errors 0 → tests hijau (hooks 8, loader 0, patcher 14, paths 12/12,
profile 10/10, telegram 19/19, prompt-racikan 8/0) → uninstall (hash-verify
clean semua, porcelain 0) → reinstall → boot 5 plugins errors 0. manifest
stage 4.7 + patches 06/07. zen-pack-progress.md 4.6+4.7 ✅.
INSIDEN: `git clean -fdx` awal hapus node_modules + user-config.json (gitignored
data) → 14 test fail palsu; restore via npm install + cp example → semua hijau.
Pelajaran: JANGAN pakai -x saat reset sandbox target.
PATCHER: tak perlu di-extend (F3 gate lolos dengan replaceLine existing).
