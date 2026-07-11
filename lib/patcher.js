// lib/patcher.js — mesin "anchor": nyisipin patch ke file core secara AMAN & bisa dibalik.
// Prinsip: backup+hash SEBELUM sentuh apa pun, cocok-anchor PERSIS, idempotent (aman diulang),
// node --check setelah inject (gagal -> auto-restore), catat hash buat verifikasi uninstall (§1.2).
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, relative } from "node:path";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function loadHashDB(hashDbPath) {
  if (!existsSync(hashDbPath)) return {};
  try { return JSON.parse(readFileSync(hashDbPath, "utf8")); } catch { return {}; }
}
function saveHashDB(hashDbPath, db) {
  mkdirSync(dirname(hashDbPath), { recursive: true });
  writeFileSync(hashDbPath, JSON.stringify(db, null, 2));
}

// Backup + catat hash asli. Idempotent: kalau sudah tercatat, JANGAN timpa (biar hash "asli" awet).
export function backupWithHash({ targetRoot, file, backupsDir, hashDbPath }) {
  const abs = join(targetRoot, file);
  const orig = readFileSync(abs);
  const db = loadHashDB(hashDbPath);
  const bkPath = join(backupsDir, file + ".orig");
  if (!db[file]) {
    mkdirSync(dirname(bkPath), { recursive: true });
    copyFileSync(abs, bkPath);
    db[file] = { sha256: sha256(orig), backup: bkPath };
    saveHashDB(hashDbPath, db);
    return { backedUp: true, sha256: db[file].sha256 };
  }
  return { backedUp: false, sha256: db[file].sha256 }; // sudah ada, hormati yang pertama
}

// Sisipkan patch setelah baris yang cocok anchor PERSIS. Dibungkus marker biar idempotent + bisa dicabut.
export function applyPatch({ targetRoot, file, anchor, inject, marker, backupsDir, hashDbPath, nodeCheck = true }) {
  const abs = join(targetRoot, file);
  let src = readFileSync(abs, "utf8");
  const beginTag = `// >>> ${marker} >>>`;
  const endTag = `// <<< ${marker} <<<`;

  if (src.includes(beginTag)) return { status: "skipped-idempotent", file };
  if (!src.includes(anchor)) return { status: "anchor-not-found", file, anchor };

  backupWithHash({ targetRoot, file, backupsDir, hashDbPath });

  const block = `\n${beginTag}\n${inject}\n${endTag}\n`;
  const idx = src.indexOf(anchor) + anchor.length;
  const patched = src.slice(0, idx) + block + src.slice(idx);
  writeFileSync(abs, patched);

  if (nodeCheck) {
    try { execFileSync("node", ["--check", abs], { stdio: "pipe" }); }
    catch (e) {
      restore({ targetRoot, file, backupsDir, hashDbPath }); // auto-rollback kalau syntax rusak
      return { status: "node-check-failed-rolled-back", file, err: String(e.stderr || e) };
    }
  }
  return { status: "patched", file };
}

// Tempel blok ADDITIVE di akhir file (EOF). Jaminan sama: backup+hash dulu,
// idempotent via marker, node --check gagal -> auto-restore.
export function appendPatch({ targetRoot, file, inject, marker, backupsDir, hashDbPath, nodeCheck = true }) {
  const abs = join(targetRoot, file);
  const src = readFileSync(abs, "utf8");
  const beginTag = `// >>> ${marker} >>>`;
  const endTag = `// <<< ${marker} <<<`;

  if (src.includes(beginTag)) return { status: "skipped-idempotent", file };

  backupWithHash({ targetRoot, file, backupsDir, hashDbPath });

  const sep = src.endsWith("\n") ? "" : "\n";
  writeFileSync(abs, `${src}${sep}\n${beginTag}\n${inject}\n${endTag}\n`);

  if (nodeCheck) {
    try { execFileSync("node", ["--check", abs], { stdio: "pipe" }); }
    catch (e) {
      restore({ targetRoot, file, backupsDir, hashDbPath });
      return { status: "node-check-failed-rolled-back", file, err: String(e.stderr || e) };
    }
  }
  return { status: "appended", file };
}

// Ganti SATU baris exact-match. Jaminan sama dgn applyPatch: backup+hash dulu,
// OLD wajib unik (0 -> old-not-found, >1 -> old-not-unique), idempotent (NEW sudah
// ada & OLD hilang -> skipped), node --check gagal -> auto-restore ke ASLI pre-patch.
export function replaceLine({ targetRoot, file, oldLine, newLine, backupsDir, hashDbPath, nodeCheck = true }) {
  const abs = join(targetRoot, file);
  const src = readFileSync(abs, "utf8");

  // Idempotent duluan: NEW utuh sudah terpasang -> skip. (Wajib SEBELUM cek OLD:
  // ada patch yang NEW-nya mengandung OLD, mis. 03b sisip-blok-di-atas-anchor.)
  if (src.includes(newLine)) return { status: "skipped-idempotent", file };

  const count = src.split(oldLine).length - 1;
  if (count === 0) return { status: "old-not-found", file, oldLine };
  if (count > 1) return { status: "old-not-unique", file, oldLine, count };

  backupWithHash({ targetRoot, file, backupsDir, hashDbPath });

  writeFileSync(abs, src.replace(oldLine, newLine));

  if (nodeCheck) {
    try { execFileSync("node", ["--check", abs], { stdio: "pipe" }); }
    catch (e) {
      restore({ targetRoot, file, backupsDir, hashDbPath });
      return { status: "node-check-failed-rolled-back", file, err: String(e.stderr || e) };
    }
  }
  return { status: "replaced", file };
}

// Kembalikan file ke kondisi asli dari backup.
export function restore({ targetRoot, file, backupsDir, hashDbPath }) {
  const abs = join(targetRoot, file);
  const bkPath = join(backupsDir, file + ".orig");
  if (!existsSync(bkPath)) return { status: "no-backup", file };
  copyFileSync(bkPath, abs);
  return { status: "restored", file };
}

// §1.2: verifikasi hasil restore == hash asli pre-install. Cocok = uninstall bersih.
export function verifyRestored({ targetRoot, file, hashDbPath }) {
  const abs = join(targetRoot, file);
  const db = loadHashDB(hashDbPath);
  if (!db[file]) return { status: "no-record", file };
  const now = sha256(readFileSync(abs));
  return { status: now === db[file].sha256 ? "clean" : "MISMATCH", file, expected: db[file].sha256, got: now };
}
