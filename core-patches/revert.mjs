// Kembalikan file yang dipatch ke kondisi asli + verifikasi hash (§1.2).
// Pakai: node core-patches/revert.mjs <path-target>
// no-record = tidak pernah dipatch -> bukan error. MISMATCH -> exit 1 (jangan lanjut hapus).
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { restore, verifyRestored } from "../lib/patcher.js";

const targetRoot = process.argv[2];
if (!targetRoot) { console.error("pakai: node core-patches/revert.mjs <path-target>"); process.exit(1); }

const patchesDir = dirname(fileURLToPath(import.meta.url));
const backupsDir = join(targetRoot, ".zenpack", "backups");
const hashDbPath = join(targetRoot, ".zenpack", "pre-install-hashes.json");

const defs = readdirSync(patchesDir).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const f of defs) {
  const { default: p } = await import(pathToFileURL(join(patchesDir, f)).href);
  const r = restore({ targetRoot, file: p.file, backupsDir, hashDbPath });
  if (r.status === "no-backup") { console.log(`[zen-pack revert] ${f}: no-backup (belum pernah dipatch)`); continue; }
  const v = verifyRestored({ targetRoot, file: p.file, hashDbPath });
  console.log(`[zen-pack revert] ${f}: ${r.status}, verify: ${v.status}`);
  if (v.status !== "clean") failed++;
}
process.exit(failed ? 1 : 0);
