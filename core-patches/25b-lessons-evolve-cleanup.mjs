// Patch 25b: W3 racikan isolation at evolve chokepoint + W4 dead percentile deletion.
export default [{
  file: "lessons.js",
  marker: "zen-pack:25b-lessons-evolve-cleanup",
  replaces: [
    {
      old: "export function evolveThresholds(perfData, config) {\n  if (!perfData || perfData.length < MIN_EVOLVE_POSITIONS) return null;",
      new: "export function evolveThresholds(perfData, config) {\n  // Active-racikan isolation at the chokepoint: BOTH the auto-loop (livePerf,\n  // already filtered) and the manual /evolve (raw performance[]) only ever tune\n  // on the current racikan's trades. Future-proof — no hardcoded racikan name.\n  perfData = (perfData || []).filter(keepActiveRacikan);\n  if (!perfData || perfData.length < MIN_EVOLVE_POSITIONS) return null;",
    },
    {
      old: "  // ── 1. minFeeActiveTvlRatio ────────────────────────────────────\n  // Raise the floor if low-fee pools consistently underperform.",
      new: "  // ── 1. minFeeActiveTvlRatio ───────────────────────────────────\n  // Raise the floor if low-fee pools consistently underperform.",
    },
    {
      old: "  if (changes.minOrganic       != null) s.minOrganic       = changes.minOrganic;",
      new: "  if (changes.minOrganic           != null) s.minOrganic           = changes.minOrganic;",
    },
    {
      old: "function percentile(arr, p) {\n  const sorted = [...arr].sort((a, b) => a - b);\n  const idx = (p / 100) * (sorted.length - 1);\n  const lo = Math.floor(idx);\n  const hi = Math.ceil(idx);\n  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);\n}\n\n",
      new: "// >>> zen-pack:25b-remove-unused-percentile >>>\n// <<< zen-pack:25b-remove-unused-percentile <<<\n\n",
    },
  ],
}];
