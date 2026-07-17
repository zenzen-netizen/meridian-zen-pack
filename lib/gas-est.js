export const GAS_EST_SOL = {
  deploy_position: 0.00004, // ~2-3 txs
  close_position: 0.00003,
  claim_fees: 0.000015,
  swap_token: 0.000015,
};

/** Estimated gas (SOL) from a map of { tool: count }. */
export function estimateGasSol(counts = {}) {
  return Object.entries(GAS_EST_SOL).reduce((s, [tool, perSol]) => s + (counts[tool] || 0) * perSol, 0);
}
