// Patch 01: tanam hook bus + plugin loader ke index.js target.
// Anchor = baris 1 vanilla (envcrypt). Import statik di-hoist ESM, jadi seluruh
// import vanilla tetap evaluasi duluan; loadPlugins jalan sebagai statement body
// PERTAMA — sebelum kode daemon lain, sesudah env ter-decrypt.
export default {
  file: "index.js",
  marker: "zen-pack:01-hook-bus",
  anchor: `import "./envcrypt.js";`,
  inject: [
    `import * as __zenpackHooks from "./zenpack-lib/hooks.js";`,
    `import { loadPlugins as __zenpackLoadPlugins } from "./zenpack-lib/loader.js";`,
    `import { fileURLToPath as __zenpackFileURLToPath } from "node:url";`,
    `const __zenpackResult = await __zenpackLoadPlugins(`,
    `  __zenpackFileURLToPath(new URL("./zenpack-plugins", import.meta.url)),`,
    `  __zenpackHooks,`,
    `);`,
    `console.log(\`[zen-pack] loaded \${__zenpackResult.loaded.length} plugins (skipped \${__zenpackResult.skipped.length}, errors \${__zenpackResult.errors.length})\`);`,
    `for (const e of __zenpackResult.errors) console.warn(\`[zen-pack] plugin error: \${e.file}: \${e.err}\`);`,
  ].join("\n"),
};
