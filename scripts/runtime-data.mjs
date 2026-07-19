import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entries = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")).runtime_data.entries;
const patterns = entries.map((entry) => entry.path);

function matches(pattern, relativePath) {
  if (pattern.endsWith("/")) return relativePath.startsWith(pattern);
  const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*")}$`);
  return regex.test(relativePath);
}

export function isRuntimeData(relativePath) {
  return patterns.some((pattern) => matches(pattern, relativePath));
}

export function existingRuntimeData(target) {
  const rootNames = new Set(readdirSync(target));
  return patterns.filter((pattern) => {
    if (pattern.includes("*")) return [...rootNames].some((name) => matches(pattern, name));
    return existsSync(join(target, pattern.replace(/\/$/, "")));
  });
}

export function unexpectedPorcelain(target) {
  const output = execFileSync("git", ["-C", target, "status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" });
  return output.split("\n").filter(Boolean).map((line) => line.slice(3).split(" -> ").at(-1)).filter((path) => !isRuntimeData(path));
}

const [command, targetArg] = process.argv.slice(2);
if (command) {
  const target = resolve(targetArg || ".");
  if (command === "existing") {
    process.stdout.write(existingRuntimeData(target).join(", ") || "none");
  } else if (command === "check") {
    const unexpected = unexpectedPorcelain(target);
    if (unexpected.length) {
      console.error(`unexpected porcelain: ${unexpected.join(", ")}`);
      process.exit(1);
    }
  } else {
    throw new Error(`unknown command: ${command}`);
  }
}
