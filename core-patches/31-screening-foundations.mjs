// Stage 7.8-B: bounded GMGN producer/formatter + one candidate cache.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip31", name), "utf8").replace(/\n$/, "");

export default [
  {
    file: "tools/gmgn.js",
    marker: "zen-pack:31-gmgn-producer",
    replaces: [{ old: snip("gmgn-OLD.txt"), new: snip("gmgn-NEW.txt") }],
  },
  {
    file: "tools/screening.js",
    marker: "zen-pack:31-screening-gmgn-dispatch",
    replaces: [
      {
        old: 'import { getAgentMeridianBase, getAgentMeridianHeaders } from "./agent-meridian.js";',
        new: 'import { getAgentMeridianBase, getAgentMeridianHeaders } from "./agent-meridian.js";\nimport { discoverGmgnPools } from "./gmgn.js";',
      },
      { old: snip("screening-getTop-OLD.txt"), new: snip("screening-getTop-NEW.txt") },
    ],
  },
  {
    file: "index.js",
    marker: "zen-pack:31-shared-candidate-cache",
    replaces: [
      { old: snip("cache-local-OLD.txt"), new: snip("cache-local-NEW.txt") },
      {
        old: 'import { fileURLToPath as __zenpackFileURLToPath } from "node:url";',
        new: 'import { fileURLToPath as __zenpackFileURLToPath } from "node:url";\nimport { getLatestCandidatesMeta, setLatestCandidates } from "./zenpack-lib/candidate-cache.js";',
      },
      { old: snip("cache-describe-OLD.txt"), new: snip("cache-describe-NEW.txt") },
      { old: snip("cache-deploy-OLD.txt"), new: snip("cache-deploy-NEW.txt") },
    ],
  },
];
