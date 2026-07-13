// Patch 09: DRY_RUN dari user-config MENANG atas env — samakan ke fork.
// Vanilla config.js:41 pakai `||=` → env DRY_RUN yg sudah ada menang, user-config
// diabaikan. Fork: assign langsung `=` → user-config.json `dryRun` menang.
// replaceLine (OLD unik, count=1 di config.js:41). Routing tak tersentuh.
const M = "zen-pack:09-dryrun-userconfig-wins";

export default [
  { file: "config.js", marker: M, replaces: [
    { old: `if (u.dryRun !== undefined) process.env.DRY_RUN ||= String(u.dryRun);`,
      new: `if (u.dryRun !== undefined) process.env.DRY_RUN = String(u.dryRun); // [zen-pack:09] user-config wins` },
  ]},
];
