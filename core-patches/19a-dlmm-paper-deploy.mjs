// Patch 19a: tools/dlmm.js paper imports + deploy branch (A0/A1).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip19", n), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:19a-dlmm-paper-deploy",
  replaces: [
    {
      old: "  getTrackedPosition,\n  minutesOutOfRange,",
      new: "  getTrackedPosition,\n  getTrackedPositions,\n  minutesOutOfRange,",
    },
    {
      old: "import { recordPerformance } from \"../lessons.js\";\nimport { isBaseMintOnCooldown, isPoolOnCooldown } from \"../pool-memory.js\";\nimport { normalizeMint } from \"./wallet.js\";\nimport { appendDecision } from \"../decision-log.js\";",
      new: "import { recordPerformance } from \"../lessons.js\";\nimport { estimateGasSol } from \"../zenpack-lib/gas-est.js\";\nimport { isBaseMintOnCooldown, isPoolOnCooldown } from \"../pool-memory.js\";\nimport { normalizeMint, getWalletBalances, swapToken } from \"./wallet.js\";\nimport {\n  isPaperMode,\n  makePaperPositionId,\n  simulatePaperMetrics,\n  timeframeMinutes,\n  classifyPaperEdge,\n  formatPaperDecomposition,\n} from \"../paper-trading.js\";\nimport { appendDecision } from \"../decision-log.js\";",
    },
    {
      old: "  initial_value_usd,\n  // entry market conditions (injected by executor safety checks)",
      new: "  initial_value_usd,\n  narrative_category, // 🧪 #7: optional narrative bucket for performance learning\n  // entry market conditions (injected by executor safety checks)",
    },
    { old: snip("a1-OLD.txt"), new: snip("a1-NEW.txt") },
  ],
}];
