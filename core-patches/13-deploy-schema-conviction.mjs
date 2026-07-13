// Patch 13: schema deploy_position — tambah narrative_category + conviction.
// Konsumen: applyConvictionSizing (executor.js:885, diport patch 12 blok 3) baca
// args.conviction — tanpa field ini di schema, LLM tak pernah kirim conviction,
// conviction-sizing experiment mati diam-diam.
// Anchor unik vanilla-test/tools/definitions.js:195 (count=1). Verbatim fork-ref
// tools/definitions.js:195-203.
// Hunk 1-2 (get_time_profile/get_narrative_profile schema): SKIP — sudah full via
// zenpack-plugins/20-profile-tools.js (registrar patch 04b). Hunk 4 (update_config
// docs): DEFER bareng blok 1 update_config (5.5), posisi terpisah dari hunk ini.
const M = "zen-pack:13-deploy-schema-conviction";

export default [
  { file: "tools/definitions.js", marker: M, replaces: [
    { old: `          initial_value_usd: { type: "number", description: "Estimated USD value being deployed" }`,
      new: `          initial_value_usd: { type: "number", description: "Estimated USD value being deployed" }, // [zen-pack:13]
          narrative_category: {
            type: "string",
            // KEEP IN SYNC with NARRATIVE_CATEGORIES in lessons.js
            enum: ["animal", "ai", "political", "celebrity", "meme", "culture", "tech_utility", "other"],
            description: "Optional: classify the token's narrative into ONE bucket for performance learning (animal=dog/cat/frog/etc, ai=AI/agent, political, celebrity=person/influencer, meme=viral moment/internet meme, culture=community/movement/ideology, tech_utility=infra/defi/real use, other). Used only for narrative-profile stats; never affects this deploy."
          },
          conviction: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Optional: your conviction in THIS setup. Only has an effect when the conviction-sizing experiment is on — high nudges the deploy size up, low nudges it down, both strictly within the configured min/max. medium (or omitted) = no change. Inert otherwise."
          }` },
  ]},
];
