// Stage 7.10-B: complete the four fork Jupiter symbol/display hunks in tools/pnl.js.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip35", name), "utf8").replace(/\n$/, "");

const JUPITER_OLD = `// ─── Jupiter prices (never cached) ──────────────────────────────
async function getJupiterPrices(mints) {
  const list = unique(mints.map((m) => String(m).trim()));
  if (!list.length) return {};
  try {
    const res = await fetch(\`${"${JUP_SEARCH}"}?query=${"${list.join(\",\")}"}\`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(\`Jupiter ${"${res.status}"}\`);
    const assets = await res.json();
    const out = {};
    for (const a of assets) out[a.id] = maybeNum(a.usdPrice);
    return out;
  } catch (e) {
    log("pnl_price", \`Jupiter price fetch failed: ${"${e.message}"}\`);
    return {};
  }
}`;

export default [{
  file: "tools/pnl.js",
  marker: "zen-pack:35-pnl-jupiter-display",
  replaces: [
    {
      old: JUPITER_OLD,
      new: `// >>> zen-pack:35-jupiter-prices-symbols >>>
${snip("jupiter-NEW.txt")}
// <<< zen-pack:35-jupiter-prices-symbols <<<`,
    },
    {
      old: "function buildPosition(f, prices, solUsd, meteora, solMode) {",
      new: "// >>> zen-pack:35-pnl-display-position >>>\nfunction buildPosition(f, prices, symbols, solUsd, meteora, solMode) {",
    },
    {
      old: '    pair:               tracked?.pool_name || (meteora ? `${meteora.tokenX ?? "?"}/${meteora.tokenY ?? "SOL"}` : "?/SOL"),',
      new: `    pair:               resolveDisplayPair(
                          tracked?.pool_name || (meteora ? \`${"${meteora.tokenX ?? \"?\"}"}-${"${meteora.tokenY ?? \"SOL\"}"}\` : "?-SOL"),
                          f.baseMint,
                          f.baseMint ? symbols[f.baseMint] : null,
                        ),
// <<< zen-pack:35-pnl-display-position <<<`,
    },
    {
      old: `  const [prices, meteoraByPosition] = await Promise.all([
    getJupiterPrices([SOL_MINT, ...flat.map((f) => f.baseMint)]),
    getMeteoraData(conn, walletAddress, flat),
  ]);
  const solUsd = prices[SOL_MINT] ?? null;

  const positions = flat.map((f) => buildPosition(f, prices, solUsd, meteoraByPosition[f.position], solMode));`,
      new: `  // >>> zen-pack:35-pnl-display-consumer >>>
  const [{ prices, symbols }, meteoraByPosition] = await Promise.all([
    getJupiterPrices([SOL_MINT, ...flat.map((f) => f.baseMint)]),
    getMeteoraData(conn, walletAddress, flat),
  ]);
  const solUsd = prices[SOL_MINT] ?? null;

  const positions = flat.map((f) => buildPosition(f, prices, symbols, solUsd, meteoraByPosition[f.position], solMode));
  // <<< zen-pack:35-pnl-display-consumer <<<`,
    },
  ],
}];
