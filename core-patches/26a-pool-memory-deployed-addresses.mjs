// Stage 6.6 dependency: exact fork helper used by briefing counterfactual review.
export default [{
  file: "pool-memory.js",
  marker: "zen-pack:26a-pool-memory-deployed-addresses",
  replaces: [{
    old: "/**\n * Tool handler: get_pool_memory\n * Returns deploy history and summary for a pool.\n */\nexport function getPoolMemory({ pool_address }) {",
    new: "/**\n * Tool handler: get_pool_memory\n * Returns deploy history and summary for a pool.\n */\n/**\n * All pool addresses we have ever deployed into (the pool-memory keys). Used by\n * the 🧪 counterfactual skip-review to tell \"deployed\" from \"merely looked at\".\n */\nexport function getDeployedPoolAddresses() {\n  return Object.keys(load());\n}\n\nexport function getPoolMemory({ pool_address }) {",
  }],
}];
