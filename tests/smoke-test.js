// tests/smoke-test.js — agregator smoke v0.2 (dijalankan `npm test`).
// 1) node --check semua lib/*.js  2) sub-test hooks/patcher/loader (loader pakai fixture testplugins/)
// 3) inventaris drop-in TANPA import: hitung file cocok manifest.drop_ins + node --check semuanya.
//    (JANGAN loadPlugins() ke plugins/ asli — drop-in bergantung pohon bot, import meledak di repo pack.)
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// 1. node --check semua .js di lib/
for (const f of readdirSync(join(ROOT, "lib")).filter((x) => x.endsWith(".js"))) {
  try { execFileSync("node", ["--check", join(ROOT, "lib", f)], { stdio: "pipe" }); console.log("  ✅ node --check lib/" + f); }
  catch (e) { failures.push(`node --check lib/${f}: ${String(e.stderr || e)}`); console.log("  ❌ node --check lib/" + f); }
}

// 2. Sub-test: hooks (8/8), patcher (6/6), loader (fixture testplugins/)
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

// 3. Inventaris drop-in vs manifest.json.drop_ins (tanpa import; syntax-only)
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const expect = manifest.drop_ins ?? {};
const dirs = [
  ["plugins", "plugins"],
  ["views", "views"],
  ["tools-extra", "tools_extra"],
  ["scripts", "scripts"],
];
for (const [dir, key] of dirs) {
  const files = readdirSync(join(ROOT, dir)).filter((x) => x.endsWith(".js"));
  if (files.length !== expect[key]) {
    failures.push(`inventaris ${dir}/: ${files.length} file, manifest bilang ${expect[key]}`);
    console.log(`  ❌ inventaris ${dir}/: ${files.length} != ${expect[key]}`);
    continue;
  }
  let bad = 0;
  for (const f of files) {
    try { execFileSync("node", ["--check", join(ROOT, dir, f)], { stdio: "pipe" }); }
    catch (e) { bad++; failures.push(`node --check ${dir}/${f}: ${String(e.stderr || e)}`); }
  }
  if (bad === 0) console.log(`  ✅ inventaris ${dir}/: ${files.length}/${expect[key]} file, node --check semua lolos`);
  else console.log(`  ❌ inventaris ${dir}/: ${bad} file gagal node --check`);
}

if (failures.length) {
  console.log("\nSMOKE v0.2: FAIL");
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}
console.log("\nSMOKE v0.2: PASS");
process.exit(0);
