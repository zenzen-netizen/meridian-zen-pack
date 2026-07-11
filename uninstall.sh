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
for d in zenpack-lib plugins views tools-extra scripts; do
  [[ -d "$TARGET/$d" ]] && find "$TARGET/$d" -type d -empty -delete
done

# 2. TODO Stage 3: restore patched files (restore + verifyRestored dari lib/patcher.js).
#    v0: belum ada patch, skip.

# Bersihkan metadata pack
rm -rf "$TARGET/.zenpack"

# 3. Verifikasi bersih: porcelain kosong = vanilla murni pulih
PORCELAIN="$(git -C "$TARGET" status --porcelain)"
if [[ -z "$PORCELAIN" ]]; then
  echo "git status --porcelain: KOSONG (vanilla murni pulih)"
else
  echo "git status --porcelain: MASIH ADA SISA:"
  echo "$PORCELAIN"
fi

echo "UNINSTALL v0 OK"
