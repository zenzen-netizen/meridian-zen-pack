// Patch 03a: tempel 2 fungsi BACA racikan dari fork ke akhir lessons.js vanilla.
// ADDITIVE murni — nol baris existing berubah. Sumber VERBATIM fork-ref/lessons.js:931-954
// (pakai load() internal vanilla, shape {lessons, performance} — diverifikasi Fase 0).
const inject = '/**\n * Live closed-position perf for ONE racikan (active_setup), across the current\n * lessons.json. Display only — used by the `/report <racikan>` tier. The archive\n * is excluded (its records are unattributed / active_setup=null).\n */\nexport function getPerformanceForRacikan(name) {\n  const target = String(name || "").trim().toLowerCase();\n  if (!target) return [];\n  return (load().performance || []).filter(\n    (p) => !p.paper && String(p.active_setup || "").toLowerCase() === target,\n  );\n}\n\n/** Distinct racikan names present in the live performance log (for `/report setups`). */\nexport function listRacikanInPerformance() {\n  const counts = {};\n  for (const p of (load().performance || [])) {\n    if (p.paper) continue;\n    const k = p.active_setup || null;\n    if (!k) continue;\n    counts[k] = (counts[k] || 0) + 1;\n  }\n  return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);\n}';

export default [
  { file: "lessons.js", marker: "zen-pack:03a-lessons-racikan-helpers", append: inject },
];
