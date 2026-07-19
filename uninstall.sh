#!/usr/bin/env bash
# uninstall.sh v0 — hapus file yang disalin install.sh, kembalikan target ke vanilla murni.
# Pakai: bash uninstall.sh <path-target-vanilla>
set -euo pipefail

TARGET="${1:?pakai: bash uninstall.sh <path-target>}"
MANIFEST="$TARGET/.zenpack/install-manifest.txt"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Tidak ada install-manifest.txt di $TARGET/.zenpack — tidak ada yang di-uninstall"
  exit 1
fi

# 1. Hapus tiap file yang tercatat disalin
while read -r f; do
  [[ -n "$f" ]] && rm -f "$TARGET/$f"
done < "$MANIFEST"

# Hapus folder yang jadi kosong setelah file dihapus
for d in zenpack-lib zenpack-plugins views tools scripts; do
  [[ -d "$TARGET/$d" ]] && find "$TARGET/$d" -type d -empty -delete
done

# 2. Restore file yang dipatch + verifikasi hash asli (Stage 3).
#    MISMATCH -> berhenti SEBELUM hapus .zenpack (backup masih ada buat investigasi).
PACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$PACK_DIR/core-patches/revert.mjs" "$TARGET"

# Bersihkan metadata pack
rm -rf "$TARGET/.zenpack"

# 3. Verifikasi bersih: porcelain kosong = vanilla murni pulih
PORCELAIN="$(git -C "$TARGET" status --porcelain)"
if [[ -z "$PORCELAIN" ]]; then
  echo "git status --porcelain: KOSONG (vanilla murni pulih)"
elif node "$PACK_DIR/scripts/runtime-data.mjs" check "$TARGET"; then
  echo "git status --porcelain: HANYA runtime_data whitelist"
else
  echo "git status --porcelain: MASIH ADA SISA:"
  echo "$PORCELAIN"
  echo "UNINSTALL v0 FAIL"
  echo "left runtime data: $(node "$PACK_DIR/scripts/runtime-data.mjs" existing "$TARGET")"
  exit 1
fi

echo "UNINSTALL v0 OK"
echo "left runtime data: $(node "$PACK_DIR/scripts/runtime-data.mjs" existing "$TARGET")"
