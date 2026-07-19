// Single candidate-cache owner shared by core interactive paths and Plugin 70.
let candidates = [];
let updatedAt = null;

export function setLatestCandidates(next = []) {
  candidates = Array.isArray(next) ? next : [];
  updatedAt = new Date().toISOString();
}

export function getLatestCandidatesMeta() {
  return { candidates, count: candidates.length, updatedAt };
}

export function resetLatestCandidates() {
  candidates = [];
  updatedAt = null;
}
