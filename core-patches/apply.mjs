// Apply semua patch core-patches/NN-*.mjs ke target via lib/patcher.js.
// Pakai: node core-patches/apply.mjs <path-target>
// Idempotent: marker sudah ada -> skipped-idempotent. Syntax rusak -> auto-rollback + exit 1.
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyPatch } from "../lib/patcher.js";

const targetRoot = process.argv[2];
if (!targetRoot) { console.error("pakai: node core-patches/apply.mjs <path-target>"); process.exit(1); }

const patchesDir = dirname(fileURLToPath(import.meta.url));
const backupsDir = join(targetRoot, ".zenpack", "backups");
const hashDbPath = join(targetRoot, ".zenpack", "pre-install-hashes.json");

const defs = readdirSync(patchesDir).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const f of defs) {
  const { default: p } = await import(pathToFileURL(join(patchesDir, f)).href);
  const r = applyPatch({ targetRoot, backupsDir, hashDbPath, ...p });
  console.log(`[zen-pack patch] ${f}: ${r.status}`);
  if (r.status !== "patched" && r.status !== "skipped-idempotent") { failed++; if (r.err) console.error(r.err); }
}
process.exit(failed ? 1 : 0);
