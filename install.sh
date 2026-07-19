#!/usr/bin/env bash
# Pakai: bash install.sh [--no-deps] <path-target-vanilla>
set -euo pipefail

NO_DEPS=false
if [[ "${1:-}" == "--no-deps" ]]; then
  NO_DEPS=true
  shift
fi
TARGET="${1:?pakai: bash install.sh [--no-deps] <path-target>}"
if [[ $# -ne 1 ]]; then
  echo "pakai: bash install.sh [--no-deps] <path-target>"
  exit 1
fi
PACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Verifikasi target valid
if [[ ! -f "$TARGET/index.js" ]] || ! grep -q '"name": "dlmm-agent"' "$TARGET/package.json"; then
  echo "BUKAN target meridian valid"
  exit 1
fi

# Dependency vanilla bukan milik pack, tetapi target fresh harus bisa boot sebelum dipatch.
if [[ "$NO_DEPS" == true ]]; then
  echo "[zen-pack deps] --no-deps: skip dependency install"
elif [[ -d "$TARGET/node_modules" ]]; then
  echo "[zen-pack deps] node_modules present: skip npm install"
else
  echo "[zen-pack deps] node_modules absent: running npm install --no-package-lock"
  if ! npm --prefix "$TARGET" install --no-package-lock; then
    echo "[zen-pack deps] npm install FAILED — STOP before copy/patch"
    exit 1
  fi
  echo "[zen-pack deps] npm install OK"
fi

mkdir -p "$TARGET/.zenpack"
MANIFEST="$TARGET/.zenpack/install-manifest.txt"
# JANGAN truncate: manifest lama = daftar file milik kita (jalur upgrade/reinstall).
# Truncate di sini pernah bikin uninstall buta pasca-install-gagal (insiden 3.3).
touch "$MANIFEST"

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
    # Milik kita = tercatat di manifest ATAU isi identik -> boleh timpa (upgrade/reinstall).
    # File asing beda isi = punya vanilla -> STOP, jangan timpa.
    if [[ -e "$TARGET/$rel" ]] && ! cmp -s "$PACK_DIR/$src/$f" "$TARGET/$rel" \
       && ! grep -qxF "$rel" "$MANIFEST"; then
      echo "TABRAKAN: $rel sudah ada di target dgn isi beda (bukan pure-add) — STOP"
      exit 1
    fi
    mkdir -p "$TARGET/$(dirname "$rel")"
    cp "$PACK_DIR/$src/$f" "$TARGET/$rel"
    grep -qxF "$rel" "$MANIFEST" || echo "$rel" >> "$MANIFEST"
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
  grep -qxF "SETTINGS-GUIDE.md" "$MANIFEST" || echo "SETTINGS-GUIDE.md" >> "$MANIFEST"
fi

# 4. Apply patch anchor (Stage 3) — idempotent via marker, auto-rollback kalau syntax rusak
node "$PACK_DIR/core-patches/apply.mjs" "$TARGET"

echo "INSTALL OK (copy + patches)"
