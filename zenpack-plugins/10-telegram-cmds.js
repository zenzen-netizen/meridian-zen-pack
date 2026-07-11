// Wiring Telegram batch 1: /addprofil + /export via hook "telegram:command".
// Wrapper runExportCommand/runAddProfilCommand/exportUsageText = VERBATIM fork-ref
// index.js:2788-2891; adaptasi HANYA: (a) jadi handler hook, (b) balasan via ctx.reply,
// (c) path import relatif dari zenpack-plugins/. /preset SENGAJA belum (Stage 3.4).
import { exportRacikan, listExportableRacikan } from "../racikan-export.js";
import { exportProfil } from "../profil-export.js";
import { scaffoldProfil, listProfil } from "../addprofil.js";
import { presetExists } from "../preset-manager.js";
import { listRacikanInPerformance } from "../lessons.js";
import { ICON, SEP, tree, header } from "../views/format.js";

export const manifest = { name: "zenpack-telegram-cmds", priority: 100 };

// ─── Export racikan (/export) ─────────────────────────────────────
function exportUsageText() {
  return [
    header("📦", "/export", "ekspor racikan (config + riwayat, secret di-strip)"),
    tree([
      "/export racikan — daftar racikan yang bisa diekspor",
      "/export racikan <nama> — ekspor 1 racikan ke folder exports/",
      "/export racikan <nama> tar — sama, dibungkus 1 file .tar.gz",
      "/export profil — backup 1 profil penuh (config+data, berisi secret, offline)",
      "/export profil tar — sama, dibungkus 1 file .tar.gz",
    ]),
  ].join("\n");
}

// Returns { text }. Pure (file ops only) — read-only riwayat, tulis file baru
// di exports/ saja (tidak menyentuh user-config.json / presets/).
function runExportCommand(argStr) {
  const parts = String(argStr || "").trim().split(/\s+/).filter(Boolean);
  const sub = (parts[0] || "").toLowerCase();
  const name = parts[1];
  try {
    if (sub === "profil") {
      const wantTar = (parts[1] || "").toLowerCase() === "tar";
      const r = exportProfil({ archive: wantTar });
      return { text: [
        header(ICON.ok, `Export profil "${r.label}"`, "config + presets + data (BERISI SECRET)"),
        tree([
          `${r.copiedCount} file disalin`,
          r.skipped.length ? `dilewati (belum ada): ${r.skipped.join(", ")}` : "semua file profil ada",
          `${r.archived ? "Arsip" : "Folder"}: ${r.outDir}`,
          `${ICON.warn} Berisi secret (rpcUrl/telegram/apikey) — simpan OFFLINE, jangan upload publik.`,
        ]),
      ].join("\n") };
    }
    if (sub !== "racikan") return { text: exportUsageText() };
    if (!name) {
      const list = listExportableRacikan();
      return { text: [
        header("📦", "/export racikan", "pilih nama"),
        SEP,
        list.length ? tree(list) : "Belum ada racikan (preset atau riwayat).",
        SEP, exportUsageText(),
      ].join("\n") };
    }
    if (!presetExists(name) && !listRacikanInPerformance().some((r) => r.name === name)) {
      return { text: `${ICON.warn} Racikan "${name}" tidak ditemukan (bukan preset & tak ada di riwayat).` };
    }
    const archive = (parts[2] || "").toLowerCase() === "tar";
    const r = exportRacikan(name, { archive });
    return { text: [
      header(ICON.ok, `Export "${r.name}"`, r.hasPreset ? "preset + riwayat" : "riwayat saja"),
      tree([
        `${r.recordCount} trade`,
        r.hasPreset ? `${r.strippedCount} key rahasia di-strip` : "preset file tidak ditemukan — riwayat saja",
        `${r.archived ? "Arsip" : "Folder"}: ${r.outDir}`,
      ]),
    ].join("\n") };
  } catch (e) {
    return { text: `${ICON.fail} Export error: ${e.message}` };
  }
}

// ─── Tambah profil (/addprofil) ───────────────────────────────────
// Scaffolder profil baru (isolasi data-dir). Pure file-ops — bikin folder+file
// baru di profiles/<nama>/, TIDAK menyentuh profil yang lagi jalan. Sisi secret +
// pm2 start = MANUAL (dicetak di RESTORE.txt).
function runAddProfilCommand(argStr) {
  const parts = String(argStr || "").trim().split(/\s+/).filter(Boolean);
  const name = parts[0];
  try {
    if (!name) {
      const existing = listProfil();
      return { text: [
        header("🗂️", "/addprofil", "scaffold profil baru (data-dir isolasi)"),
        SEP,
        existing.length ? `Profil ada: ${existing.join(", ")}` : "Belum ada profil di profiles/.",
        SEP,
        tree([
          "/addprofil <nama> — scaffold profil baru (folder + config + template)",
          "Sisi secret (wallet/token) + pm2 start = MANUAL (lihat RESTORE.txt).",
        ]),
      ].join("\n") };
    }
    const r = scaffoldProfil(name);
    return { text: [
      header(ICON.ok, `Profil "${r.name}" ter-scaffold`, "data-dir + config + template"),
      tree([
        `${r.created.length} item dibuat di profiles/${r.name}/`,
        `Config: dryRun=true (paper, aman sampai owner flip)`,
        `${ICON.warn} Langkah manual owner (wallet/token/pm2) -> profiles/${r.name}/RESTORE.txt`,
      ]),
      SEP,
      r.steps,
    ].join("\n") };
  } catch (e) {
    return { text: `${ICON.fail} /addprofil error: ${e.message}` };
  }
}

export function register(hooks) {
  hooks.on("telegram:command", async (ctx) => {
    const text = String(ctx.text || "");
    if (text === "/addprofil" || text.startsWith("/addprofil ")) {
      const res = runAddProfilCommand(text.slice("/addprofil".length));
      await ctx.reply(res.text);
      ctx.handled = true;
      return;
    }
    if (text === "/export" || text.startsWith("/export ")) {
      const res = runExportCommand(text.slice("/export".length));
      await ctx.reply(res.text);
      ctx.handled = true;
      return;
    }
    // command lain: biarkan jatuh ke rantai vanilla
  }, 100);
}
