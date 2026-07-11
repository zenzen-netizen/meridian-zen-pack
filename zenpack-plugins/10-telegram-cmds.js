// Wiring Telegram batch 1+2: /addprofil + /export + /preset via hook "telegram:command".
// Wrapper runExportCommand/runAddProfilCommand/exportUsageText = VERBATIM fork-ref
// index.js:2788-2891; presetUsageText/runPresetCommand/underPm2/finishPresetApply =
// VERBATIM fork-ref index.js:2708-2788 + :2888-2900. Adaptasi HANYA: (a) jadi handler
// hook, (b) balasan via ctx.reply (finishPresetApply terima `reply` sbg argumen),
// (c) path import relatif dari zenpack-plugins/.
import { exportRacikan, listExportableRacikan } from "../racikan-export.js";
import { exportProfil } from "../profil-export.js";
import { scaffoldProfil, listProfil } from "../addprofil.js";
import { listPresets, savePreset, applyPreset, getPresetDiff, deletePreset, validName, presetExists, getActiveSetupStatus } from "../preset-manager.js";
import { listRacikanInPerformance } from "../lessons.js";
import { ICON, SEP, tree, header } from "../views/format.js";

export const manifest = { name: "zenpack-telegram-cmds", priority: 100 };

// ─── Config presets (/preset) ─────────────────────────────────────
function presetUsageText() {
  return [
    header("🗂️", "/preset", "config presets (snapshot user-config.json)"),
    tree([
      "/preset list — daftar preset",
      "/preset save <nama> — simpan config saat ini jadi preset",
      "/preset use <nama> — load preset (auto-backup + restart)",
      "/preset show <nama> — lihat apa yg berubah vs config sekarang",
      "/preset rm <nama> — hapus preset",
    ]),
  ].join("\n");
}

// Returns { text, applied?, name? }. Pure (file ops only) — no restart here.
function runPresetCommand(argStr) {
  const parts = String(argStr || "").trim().split(/\s+/).filter(Boolean);
  const sub = (parts[0] || "list").toLowerCase();
  const name = parts[1];
  try {
    if (sub === "list" || sub === "ls") {
      const presets = listPresets();
      if (!presets.length) return { text: `🗂️ Belum ada racikan. Simpan dengan: /preset save <nama>` };
      const lines = presets.map((p) => {
        if (p.error) return `! ${p.name} — tidak terbaca`;
        const mark = p.isCurrent ? "●" : "○";
        const mode = p.dryRun ? "🧪 dry-run" : "live";
        return `${mark} ${p.name} — ${mode} · ${p.keys} keys${p.isCurrent ? "  (current)" : ""}`;
      });
      const st = getActiveSetupStatus();
      const active = st.name ? `${st.name}${st.edited ? " ✎ (ada edit manual)" : ""}` : "— (belum load)";
      return { text: [
        header("🗂️", "Racikan", `aktif: ${active}`),
        SEP, tree(lines), SEP, presetUsageText(),
      ].join("\n") };
    }
    if (sub === "save") {
      if (!name) return { text: `${ICON.warn} Format: /preset save <nama>` };
      if (!validName(name)) return { text: `${ICON.warn} Nama tidak valid "${name}". Pakai huruf/angka/_/- (maks 40).` };
      const r = savePreset(name);
      return { text: `${ICON.ok} Config saat ini disimpan → preset "${name}"${r.overwritten ? " (menimpa yang lama)" : ""}.` };
    }
    if (sub === "show" || sub === "diff") {
      if (!name) return { text: `${ICON.warn} Format: /preset show <nama>` };
      if (!presetExists(name)) return { text: `${ICON.warn} Preset "${name}" tidak ada. Coba /preset list.` };
      const diffs = getPresetDiff(name);
      if (!diffs.length) return { text: `${ICON.ok} Preset "${name}" identik dengan config saat ini — tidak ada yang berubah.` };
      const shown = diffs.slice(0, 30).map((d) => `${d.key}: ${d.from} → ${d.to}`);
      if (diffs.length > 30) shown.push(`…+${diffs.length - 30} lagi`);
      return { text: [
        header("🔍", `Diff "${name}"`, `${diffs.length} setting berubah`),
        SEP, tree(shown),
      ].join("\n") };
    }
    if (sub === "use" || sub === "load") {
      if (!name) return { text: `${ICON.warn} Format: /preset use <nama>` };
      if (!presetExists(name)) return { text: `${ICON.warn} Preset "${name}" tidak ada. Coba /preset list.` };
      const diffs = getPresetDiff(name);
      const r = applyPreset(name);
      const sample = diffs.slice(0, 4).map((d) => `${d.key} ${d.from}→${d.to}`).join(", ");
      const cnt = diffs.length
        ? `${diffs.length} setting berubah (a.l. ${sample}${diffs.length > 4 ? ", …" : ""})`
        : "config sudah sama — tidak ada yang berubah";
      return { text: [
        header(ICON.ok, `Preset "${name}" di-load`, "user-config.json"),
        tree([cnt, r.backup ? `Rollback: /preset use ${r.backup}` : null]),
      ].join("\n"), applied: true, name };
    }
    if (sub === "rm" || sub === "delete" || sub === "del") {
      if (!name) return { text: `${ICON.warn} Format: /preset rm <nama>` };
      if (!presetExists(name)) return { text: `${ICON.warn} Preset "${name}" tidak ada.` };
      deletePreset(name);
      return { text: `🗑️ Preset "${name}" dihapus.` };
    }
    return { text: presetUsageText() };
  } catch (e) {
    return { text: `${ICON.fail} Preset error: ${e.message}` };
  }
}

function underPm2() {
  return process.env.pm_id !== undefined || !!process.env.PM2_HOME || !!process.env.PM2_USAGE;
}

// Called after a successful `/preset use`. A full restart is what truly applies a
// preset (DRY_RUN/wallet/RPC/model are read once at startup) — auto-restart only
// when running under pm2 (which brings the process back); otherwise instruct.
async function finishPresetApply({ viaTelegram, reply }) {
  const note = underPm2()
    ? "♻️ Auto-restart via pm2 dalam 2 detik untuk apply penuh (DRY_RUN/wallet/model dibaca saat start)…"
    : "♻️ Restart proses untuk apply penuh (mis. `pm2 restart meridian`). Restart cron saja tidak cukup — DRY_RUN/wallet/RPC/model dibaca saat start.";
  if (viaTelegram) await reply(note);
  else console.log(note);
  if (underPm2()) setTimeout(() => process.exit(0), 2000);
}

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
    if (text === "/preset" || text.startsWith("/preset ")) {
      const res = runPresetCommand(text.slice("/preset".length));
      await ctx.reply(res.text);
      if (res.applied) await finishPresetApply({ viaTelegram: true, reply: ctx.reply });
      ctx.handled = true;
      return;
    }
    // command lain: biarkan jatuh ke rantai vanilla
  }, 100);
}
