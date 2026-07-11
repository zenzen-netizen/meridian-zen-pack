// lib/loader.js — auto-scan folder plugins, daftarkan tiap plugin ke hook bus, urut by prioritas.
// Kontrak plugin: file .js yang meng-export `register(hooks)`. Opsional: export `manifest = { priority }`.
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function loadPlugins(pluginsDir, hooks) {
  let files = [];
  try { files = readdirSync(pluginsDir).filter((f) => f.endsWith(".js")); }
  catch { return { loaded: [], skipped: [], errors: [{ file: pluginsDir, err: "dir tak terbaca" }] }; }

  const entries = [];
  const skipped = [], errors = [];
  for (const f of files.sort()) {
    const abs = resolve(join(pluginsDir, f));
    try {
      const mod = await import(pathToFileURL(abs).href);
      if (typeof mod.register !== "function") { skipped.push(f); continue; } // bukan plugin, lewati
      const priority = mod.manifest?.priority ?? mod.priority ?? 100;
      entries.push({ file: f, priority, register: mod.register });
    } catch (e) { errors.push({ file: f, err: String(e.message || e) }); }
  }
  entries.sort((a, b) => a.priority - b.priority); // kecil = daftar duluan
  const loaded = [];
  for (const e of entries) {
    try { await e.register(hooks); loaded.push(e.file); }
    catch (err) { errors.push({ file: e.file, err: String(err.message || err) }); }
  }
  return { loaded, skipped, errors };
}
