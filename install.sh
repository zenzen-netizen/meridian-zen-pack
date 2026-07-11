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
copy_dir() {
  local src="$1" dstrel="$2"
  [[ -d "$PACK_DIR/$src" ]] || return 0
  mkdir -p "$TARGET/$dstrel"
  ( cd "$PACK_DIR/$src" && find . -type f ) | while read -r f; do
    f="${f#./}"
    mkdir -p "$TARGET/$dstrel/$(dirname "$f")"
    cp "$PACK_DIR/$src/$f" "$TARGET/$dstrel/$f"
    echo "$dstrel/$f" >> "$MANIFEST"
  done
}

copy_dir lib zenpack-lib
copy_dir plugins plugins
copy_dir views views          # vanilla tak punya views/ -> aman, dibuat baru
copy_dir tools-extra tools-extra

echo "INSTALL v0 OK (copy-only, no patch)"
