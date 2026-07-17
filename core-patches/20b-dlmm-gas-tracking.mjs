// Patch 20b: tools/dlmm.js sendTxTracked wrapper + gas capture call-sites.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const snip = (n) => readFileSync(join(here, "snip20", n), "utf8").replace(/\n$/, "");

export default [{
  file: "tools/dlmm.js",
  marker: "zen-pack:20b-dlmm-gas-tracking",
  replaces: [
    {
      old: 'import { getAndClearStagedSignals } from "../signal-tracker.js";',
      new: 'import { getAndClearStagedSignals } from "../signal-tracker.js";\nimport { trackTxGas } from "../gas-tracker.js";',
    },
    { old: snip("20b-wrapper-OLD.txt"), new: snip("20b-wrapper-NEW.txt") },
    {
      old: "        const txHash = await sendAndConfirmTransaction(getConnection(), createTxArray[i], signers);",
      new: '        const txHash = await sendTxTracked(createTxArray[i], signers, "deploy");',
    },
    {
      old: "        const txHash = await sendAndConfirmTransaction(getConnection(), addTxArray[i], [wallet]);",
      new: '        const txHash = await sendTxTracked(addTxArray[i], [wallet], "deploy");',
    },
    {
      old: "      const txHash = await sendAndConfirmTransaction(getConnection(), tx, [wallet, newPosition]);",
      new: '      const txHash = await sendTxTracked(tx, [wallet, newPosition], "deploy");',
    },
    { old: snip("20b-claim-OLD.txt"), new: snip("20b-claim-NEW.txt") },
    {
      old: "            const claimHash = await sendAndConfirmTransaction(getConnection(), tx, [wallet]);",
      new: '            const claimHash = await sendTxTracked(tx, [wallet], "close");',
    },
    {
      old: "        const txHash = await sendAndConfirmTransaction(getConnection(), tx, [wallet]);",
      new: '        const txHash = await sendTxTracked(tx, [wallet], "close");',
    },
    {
      old: "      const txHash = await sendAndConfirmTransaction(getConnection(), closeTx, [wallet]);",
      new: '      const txHash = await sendTxTracked(closeTx, [wallet], "close");',
    },
  ],
}];
