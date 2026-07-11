#!/usr/bin/env bash
# install.sh v0 — copy-only, BELUM apply patch anchor (itu Stage 3).
# Pakai: bash install.sh <path-target-vanilla>
set -euo pipefail

TARGET="${1:?pakai: bash install.sh <path-target>}"
PACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Verifikasi target valid
if [[ ! -f "$TARGET/index.js" ]] || ! grep -q '"name": "dlmm-agent"' "$TARGET/package.json"; then
  echo "BUKAN target meridian valid"
  exit 1
fi

mkdir -p "$TARGET/.zenpack"
MANIFEST="$TARGET/.zenpack/install-manifest.txt"
: > "$MANIFEST"

# 2. Pre-install hash groundwork (§1.2). v0: belum ada file yang dipatch -> {}
HASHDB="$TARGET/.zenpack/pre-install-hashes.json"
if [[ ! -f "$HASHDB" ]]; then
  echo '{}' > "$HASHDB"
fi

# 3. Salin file pack -> target, catat tiap file ke manifest (path relatif target)
# Layout A+ (Stage 3.1b): drop-in mencerminkan layout fork -> import relatif mereka jalan.
# PURE-ADD WAJIB: kalau file tujuan sudah ada di target (punya vanilla) -> STOP, jangan timpa.
copy_dir() {
  local src="$1" dstrel="$2"
  [[ -d "$PACK_DIR/$src" ]] || return 0
  ( cd "$PACK_DIR/$src" && find . -type f ! -name '.gitkeep' ) | while read -r f; do
    f="${f#./}"
    local rel="$dstrel/$f"; rel="${rel#./}"
    if [[ -e "$TARGET/$rel" ]] && ! cmp -s "$PACK_DIR/$src/$f" "$TARGET/$rel"; then
      echo "TABRAKAN: $rel sudah ada di target dgn isi beda (bukan pure-add) — STOP"
      exit 1
    fi
    mkdir -p "$TARGET/$(dirname "$rel")"
    cp "$PACK_DIR/$src/$f" "$TARGET/$rel"
    echo "$rel" >> "$MANIFEST"
  done
}

copy_dir lib zenpack-lib
copy_dir zenpack-plugins zenpack-plugins  # hook-plugin betulan (dibaca loader)
copy_dir plugins .            # drop-in top-level fork -> ROOT target (mirror fork)
copy_dir views views          # vanilla tak punya views/ -> aman, dibuat baru
copy_dir tools-extra tools    # smi.js -> tools/smi.js (posisi fork)
copy_dir scripts scripts      # HATI-HATI: scripts/ vanilla ADA & berisi file vanilla.
                              # copy_dir salin per-file & catat per-file -> uninstall hapus HANYA yang tercatat.

# Docs pure-add: SETTINGS-GUIDE.md -> root target
if [[ -f "$PACK_DIR/docs/SETTINGS-GUIDE.md" ]]; then
  cp "$PACK_DIR/docs/SETTINGS-GUIDE.md" "$TARGET/SETTINGS-GUIDE.md"
  echo "SETTINGS-GUIDE.md" >> "$MANIFEST"
fi

# 4. Apply patch anchor (Stage 3) — idempotent via marker, auto-rollback kalau syntax rusak
node "$PACK_DIR/core-patches/apply.mjs" "$TARGET"

echo "INSTALL OK (copy + patches)"
