// Wiring 2 tool LLM custom: get_time_profile + get_narrative_profile.
// Schema = VERBATIM fork-ref tools/definitions.js:995-1021; handler = pola fork
// tools/executor.js:258-259 (arrow ke getHourlyProfile/getNarrativeProfile, patch 04a).
// Registrasi lewat registrar runtime patch 04b (zenpackRegisterTool/zenpackRegisterToolDef)
// — dipanggil di register() saat loadPlugins(), BUKAN saat module load (jebakan ESM:
// static import jalan sebelum loadPlugins, tapi di sini yang penting registrar dipanggil
// runtime; import statis aman karena plugin sendiri di-import dinamis oleh loader).
import { zenpackRegisterTool } from "../tools/executor.js";
import { zenpackRegisterToolDef } from "../tools/definitions.js";
import { getHourlyProfile, getNarrativeProfile } from "../lessons.js";

export const manifest = { name: "zenpack-profile-tools", priority: 100 };

export function register() {
  zenpackRegisterTool("get_time_profile", () => getHourlyProfile());
  zenpackRegisterTool("get_narrative_profile", () => getNarrativeProfile());

  zenpackRegisterToolDef({
    type: "function",
    function: {
      name: "get_time_profile",
      description: `Show historical performance bucketed by the WIB (UTC+7) session a position was OPENED in.
Use to see which times of day your deploys have worked best, or before deciding whether the current session is a good time to open.
Returns per-session win-rate, avg PnL, and sample count. This is a reference/good-to-have signal — it never overrides hard screening rules. Sessions with fewer than the min sample count are not yet reliable.`,
      parameters: {
        type: "object",
        properties: {}
      }
    }
  });

  zenpackRegisterToolDef({
    type: "function",
    function: {
      name: "get_narrative_profile",
      description: `Show historical performance bucketed by the token NARRATIVE CATEGORY a position was tagged with at deploy (animal, ai, political, celebrity, meme, culture, tech_utility, other).
Use to see which narrative types have actually made money for you. Returns per-category win-rate, avg PnL, and sample count, sorted best-first.
Reference/good-to-have signal only — it never overrides hard screening rules. Categories with fewer than the min sample count are not yet reliable.`,
      parameters: {
        type: "object",
        properties: {}
      }
    }
  });
}
