// Stage 7.10-B: the two remaining bounded index consumers from fork 643e954.
// Indicator exit is management-only; the upstream vanilla 2-tick poller stays untouched.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (name) => readFileSync(join(here, "snip34", name), "utf8").replace(/\n$/, "");

const IDLE_OLD = `      log("cron", "No open positions — triggering screening cycle");
      mgmtReport = "No open positions. Triggering screening cycle.";
      runScreeningCycle().catch((e) => log("cron_error", \`Triggered screening failed: \${e.message}\`));
      return mgmtReport;`;

const INDICATOR_CALL = `      // Indicator-driven exit (opt-in, default OFF) — checked after the hard
      // deterministic rules so safety exits always win; only upgrades a STAY/CLAIM.
      const indicatorExit = await getIndicatorExitSignal(p);
      if (indicatorExit) {
        actionMap.set(p.position, indicatorExit);
        continue;
      }`;

export default [{
  file: "index.js",
  marker: "zen-pack:34-index-residue",
  replaces: [
    {
      old: 'import { getTopCandidates, degenScore } from "./tools/screening.js";',
      new: 'import { getTopCandidates, degenScore } from "./tools/screening.js";\n// >>> zen-pack:34-indicator-import >>>\nimport { confirmIndicatorPreset } from "./tools/chart-indicators.js";\n// <<< zen-pack:34-indicator-import <<<',
    },
    {
      old: IDLE_OLD,
      new: `      // >>> zen-pack:34-idle-screening-cooldown >>>
${snip("idle-NEW.txt")}
      // <<< zen-pack:34-idle-screening-cooldown <<<`,
    },
    {
      old: `      const closeRule = getDeterministicCloseRule(p, config.management);
      if (closeRule) {
        actionMap.set(p.position, closeRule);
        continue;
      }
      // Claim rule`,
      new: `      const closeRule = getDeterministicCloseRule(p, config.management);
      if (closeRule) {
        actionMap.set(p.position, closeRule);
        continue;
      }
      // >>> zen-pack:34-indicator-call >>>
${INDICATOR_CALL}
      // <<< zen-pack:34-indicator-call <<<
      // Claim rule`,
    },
    {
      old: `  return null;
}

// ═══════════════════════════════════════════
//  INTERACTIVE REPL`,
      new: `  return null;
}

// >>> zen-pack:34-indicator-helper >>>
${snip("indicator-helper-NEW.txt")}
// <<< zen-pack:34-indicator-helper <<<

// ═══════════════════════════════════════════
//  INTERACTIVE REPL`,
    },
  ],
}];
