import { applyPatch, restore, verifyRestored, backupWithHash } from "../lib/patcher.js";
import { readFileSync, writeFileSync, copyFileSync, rmSync, mkdirSync } from "node:fs";
import assert from "node:assert";

const cfg = () => ({
  targetRoot: "/home/ubuntu/meridian-zen-pack/sandbox-target",
  file: "core.js",
  backupsDir: "/home/ubuntu/meridian-zen-pack/work/backups",
  hashDbPath: "/home/ubuntu/meridian-zen-pack/work/pre-install-hashes.json",
});
function resetTarget() {
  copyFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js.pristine", "/home/ubuntu/meridian-zen-pack/sandbox-target/core.js");
  rmSync("/home/ubuntu/meridian-zen-pack/work", { recursive: true, force: true });
  mkdirSync("/home/ubuntu/meridian-zen-pack/work/backups", { recursive: true });
}
let pass = 0, fail = 0;
function t(name, fn) { resetTarget(); try { fn(); console.log("  ✅", name); pass++; } catch (e) { console.log("  ❌", name, "→", e.message); fail++; } }

t("inject setelah anchor + node --check lolos", () => {
  const r = applyPatch({ ...cfg(), anchor: "// ANCHOR:INIT",
    inject: 'console.log("plugin loaded");', marker: "ZENPACK:hook-bus" });
  assert.strictEqual(r.status, "patched");
  const out = readFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js", "utf8");
  assert.ok(out.includes("plugin loaded"));
  assert.ok(out.includes(">>> ZENPACK:hook-bus >>>"));
});

t("idempotent: patch kedua kali -> skipped (tak dobel)", () => {
  const c = cfg();
  applyPatch({ ...c, anchor: "// ANCHOR:INIT", inject: 'console.log("x");', marker: "ZENPACK:hook-bus" });
  const r2 = applyPatch({ ...c, anchor: "// ANCHOR:INIT", inject: 'console.log("x");', marker: "ZENPACK:hook-bus" });
  assert.strictEqual(r2.status, "skipped-idempotent");
  const out = readFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js", "utf8");
  assert.strictEqual((out.match(/hook-bus/g) || []).length, 2); // cuma 1 blok (2 tag: begin+end)
});

t("anchor tak ketemu -> lapor, file TIDAK berubah", () => {
  const before = readFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js", "utf8");
  const r = applyPatch({ ...cfg(), anchor: "// ANCHOR:TIDAK-ADA", inject: "x", marker: "ZENPACK:x" });
  assert.strictEqual(r.status, "anchor-not-found");
  assert.strictEqual(readFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js", "utf8"), before);
});

t("syntax rusak -> AUTO-ROLLBACK ke asli", () => {
  const before = readFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js", "utf8");
  const r = applyPatch({ ...cfg(), anchor: "// ANCHOR:INIT",
    inject: 'const x = ;', marker: "ZENPACK:bad" });
  assert.strictEqual(r.status, "node-check-failed-rolled-back");
  assert.strictEqual(readFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js", "utf8"), before); // pulih total
});

t("uninstall: restore + verify == hash asli (CLEAN)", () => {
  const c = cfg();
  applyPatch({ ...c, anchor: "// ANCHOR:INIT", inject: 'console.log("y");', marker: "ZENPACK:hook-bus" });
  restore(c);
  const v = verifyRestored(c);
  assert.strictEqual(v.status, "clean"); // byte-identik dengan sebelum install
});

t("verify MENDETEKSI file yang diubah tangan (MISMATCH)", () => {
  const c = cfg();
  backupWithHash(c); // catat hash asli
  writeFileSync("/home/ubuntu/meridian-zen-pack/sandbox-target/core.js", "// diubah manual\n");
  const v = verifyRestored(c);
  assert.strictEqual(v.status, "MISMATCH");
});

console.log(`\n  HASIL: ${pass} lulus, ${fail} gagal`);
process.exit(fail === 0 ? 0 : 1);
