// tests/smoke-test.js — agregator smoke v0 (dijalankan `npm test`).
// 1) node --check semua lib/*.js  2) sub-test hooks/patcher/loader  3) loader aman di plugins/ kosong.
import { readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loadPlugins } from "../lib/loader.js";
import { on } from "../lib/hooks.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// 1. node --check semua .js di lib/
for (const f of readdirSync(join(ROOT, "lib")).filter((x) => x.endsWith(".js"))) {
  try { execFileSync("node", ["--check", join(ROOT, "lib", f)], { stdio: "pipe" }); console.log("  ✅ node --check lib/" + f); }
  catch (e) { failures.push(`node --check lib/${f}: ${String(e.stderr || e)}`); console.log("  ❌ node --check lib/" + f); }
}

// 2. Sub-test: hooks (8/8), patcher (6/6), loader
for (const t of ["hooks.test.mjs", "patcher.test.mjs", "loader.test.mjs"]) {
  try {
    const out = execFileSync("node", [join(ROOT, "tests", t)], { stdio: "pipe", encoding: "utf8" });
    console.log("  ✅ tests/" + t);
    console.log(out.trim().split("\n").map((l) => "     " + l).join("\n"));
  } catch (e) {
    failures.push(`tests/${t} exit != 0: ${String(e.stdout || "")} ${String(e.stderr || "")}`);
    console.log("  ❌ tests/" + t);
  }
}

// 3. Loader di plugins/ asli (masih kosong) -> harus loaded:[] tanpa throw
try {
  const res = await loadPlugins(join(ROOT, "plugins"), { on });
  if (res.loaded.length !== 0 || res.errors.length !== 0) {
    failures.push(`loader plugins/ kosong: loaded=${JSON.stringify(res.loaded)} errors=${JSON.stringify(res.errors)}`);
    console.log("  ❌ loader plugins/ kosong");
  } else {
    console.log("  ✅ loader plugins/ kosong: loaded=[] errors=[] (aman)");
  }
} catch (e) {
  failures.push(`loader plugins/ kosong THROW: ${e.message}`);
  console.log("  ❌ loader plugins/ kosong (throw)");
}

if (failures.length) {
  console.log("\nSMOKE v0: FAIL");
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}
console.log("\nSMOKE v0: PASS");
process.exit(0);
