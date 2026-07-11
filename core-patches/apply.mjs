// Apply semua patch core-patches/NN-*.mjs ke target via lib/patcher.js.
// Pakai: node core-patches/apply.mjs <path-target>
// Idempotent: marker sudah ada -> skipped-idempotent. Syntax rusak -> auto-rollback + exit 1.
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyPatch, appendPatch, replaceLine } from "../lib/patcher.js";

const targetRoot = process.argv[2];
if (!targetRoot) { console.error("pakai: node core-patches/apply.mjs <path-target>"); process.exit(1); }

const patchesDir = dirname(fileURLToPath(import.meta.url));
const backupsDir = join(targetRoot, ".zenpack", "backups");
const hashDbPath = join(targetRoot, ".zenpack", "pre-install-hashes.json");

const OK = new Set(["patched", "skipped-idempotent", "replaced", "appended"]);
const defs = readdirSync(patchesDir).filter((f) => /^\d\d[a-z]?-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const f of defs) {
  const { default: p } = await import(pathToFileURL(join(patchesDir, f)).href);
  // Format lama: satu objek {file,anchor,inject,marker}. Format baru: array per-file
  // dgn opsional replaces[] (exact-line lewat replaceLine).
  for (const item of Array.isArray(p) ? p : [p]) {
    if (item.anchor) {
      const r = applyPatch({ targetRoot, backupsDir, hashDbPath, ...item });
      console.log(`[zen-pack patch] ${f} ${item.file} inject: ${r.status}`);
      if (!OK.has(r.status)) { failed++; if (r.err) console.error(r.err); continue; }
    }
    if (item.append) {
      const r = appendPatch({ targetRoot, backupsDir, hashDbPath, file: item.file, marker: item.marker, inject: item.append });
      console.log(`[zen-pack patch] ${f} ${item.file} append: ${r.status}`);
      if (!OK.has(r.status)) { failed++; if (r.err) console.error(r.err); continue; }
    }
    for (const rep of item.replaces ?? []) {
      const r = replaceLine({ targetRoot, backupsDir, hashDbPath, file: item.file, oldLine: rep.old, newLine: rep.new });
      console.log(`[zen-pack patch] ${f} ${item.file} replace: ${r.status}`);
      if (!OK.has(r.status)) { failed++; if (r.err) console.error(r.err); }
    }
  }
}
process.exit(failed ? 1 : 0);
