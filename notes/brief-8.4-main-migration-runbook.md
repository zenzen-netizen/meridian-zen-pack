# Brief 8.4 — MAIN side-by-side migration handoff

Date: 2026-07-19 (Asia/Shanghai)

## Agent verdict

**PRE-NYALA READY; NOT STARTED.** The old MAIN and the new side-by-side target
are stopped. No PM2 start/restart and no `.env` copy was performed by the
agent. Owner action begins at the runbook below.

## A. Stop and backup evidence

- Stop gate: PM2 IDs `0` and `1` were both `stopped` before backup/build. ID
  `7` was also observed stopped.
- Old MAIN: `/home/ubuntu/meridianzen`.
- Full canonical tarball (mode `0600`):
  `/home/ubuntu/meridianzen-main-pre84-20260719-153634.tar.gz`
  - SHA-256: `a3023dbc89a4a6a48b7e70d9cfbf4f10a9ecb2f73c4429f464b419d11dfbc4a5`
- Offline `/export profil` archive (mode `0600`, `.env` absent):
  `/home/ubuntu/profil_MAIN_20260719-143652.tar.gz`
  - SHA-256: `15c8bbb5ad22951838d5dd50941effda825c715b7b6d929807d34c5c20bd080d`
- Fork identity: old HEAD is
  `643e954f03305c039291a57f27fe477d4ff5e320`; remote
  `origin/experimental` resolves to the same SHA without a pull/fetch into the
  old worktree.
- The old worktree already had four pre-existing modifications before backup:
  `package-lock.json`, `package.json`, `paper-trading.js`, and `tools/dlmm.js`.
  They are captured unchanged in the tarball.
- A canonical re-hash of the old folder equalled the full tarball after export.

## B. Side-by-side build and data parity

- New target: `/home/ubuntu/meridianzen-pack`, clean vanilla clone detached at
  `5ab14b476e4e8d25c58f989c77b161721e1a505f`.
- Release installer: annotated tag `v1.0.0-yunus-5ab14b4`.
- Installer-owned dependency step succeeded without changing the upstream
  lockfile (`d89655d1441601f2bdf3067ac9555a0291fdf35e3d49b29f7a443641589aab1c`).
- Fresh dummy DRY_RUN boot: `10 loaded / 0 skipped / 0 errors`.
- Of the manifest's 26 runtime-data entries, 18 existed in MAIN and were copied
  byte-for-byte: `user-config.json`, `presets/`, `gmgn-config.json`,
  `state.json`, `lessons.json`, `lessons-archive-pre-mainzen_v2.json`,
  `pool-memory.json`, `decision-log.json`, `hivemind-cache.json`,
  `candidate-memory.json`, `signal-weights.json`, `strategy-library.json`,
  `sol-balance-history.json`, `llm-cost-log.json`, `gas-log.json`, `logs/`,
  `exports/`, and `profiles/`. Missing whitelist entries were not invented.
- `.env` was not copied.
- MAIN was already split: `user-config.json` contained zero legacy `gmgn*` keys
  and `gmgn-config.json` existed. PRA-8 migration therefore correctly no-op'd.
  For rollback safety, exact mode-0600 pre-bootstrap copies were made manually:
  - `user-config.json.pre-zenpack-pra8.bak` — SHA-256
    `052e4802af2cab4bd0b47fd78bac2efd73fa7b4194eacdf37025c59aea7117a1`
  - `gmgn-config.json.pre-zenpack-pra8.bak` — SHA-256
    `c3c6b6cdc72598b6f10e1a78995b339bd41480547134810fee10f1bc6e8de91a`
- Offline network-stubbed parity passed for `/status`, `/positions`, `/config`,
  and `/preset list`. `488` performance records were read (required: at least
  346), and `mainzen_v2_1` was present.

## C. Receh setup

`presets/receh_84.json` is an exact copy of `mainzen_v2_1.json` except:

```diff
-  "deployAmountSol": 0.1,
+  "deployAmountSol": 0.03,
```

`0.03 SOL` is the pack's enforced minimum. `applyPreset("receh_84")` was used,
so `user-config.json.activeSetup` is `receh_84`, the live config equals that
preset excluding identity metadata, and `_backup.json` contains the prior
config. The selected preset itself still has `dryRun: false`; it has not been
started and cannot start without the owner-provided `.env`.

## OWNER-ONLY start runbook

### 1. Recheck the stop boundary

```bash
pm2 ls
# Do not continue unless IDs 0 and 1 are stopped.
```

### 2. Install secrets manually

Review the old `.env`, then create the new file with the same MAIN wallet,
Telegram token/chat, RPC, and API keys. The direct copy form below is acceptable
only if every old value is intended for MAIN:

```bash
install -m 600 /home/ubuntu/meridianzen/.env /home/ubuntu/meridianzen-pack/.env
chmod 600 /home/ubuntu/meridianzen-pack/.env
```

Do not print or commit either file. Confirm the prepared data before start:

```bash
jq empty /home/ubuntu/meridianzen-pack/user-config.json
jq empty /home/ubuntu/meridianzen-pack/gmgn-config.json
jq -r '.activeSetup, .deployAmountSol' /home/ubuntu/meridianzen-pack/user-config.json
# expected: receh_84 and 0.03
```

### 3. Use a unique PM2 app

Do not start the shipped `ecosystem.config.cjs` unchanged: its app name
`meridian` can collide with old ID 0. Save this owner-local file as
`/home/ubuntu/meridianzen-pack/ecosystem.84.owner.cjs`:

```js
module.exports = {
  apps: [{
    name: "meridian-main-zenpack84",
    cwd: "/home/ubuntu/meridianzen-pack",
    script: "/home/ubuntu/meridianzen-pack/index.js",
    interpreter: "node",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    restart_delay: 5000,
    kill_timeout: 10000,
    max_restarts: 10,
    min_uptime: "10s",
    merge_logs: true,
    time: true,
    env: { NODE_ENV: "production" },
  }],
};
```

Owner start command:

```bash
pm2 start /home/ubuntu/meridianzen-pack/ecosystem.84.owner.cjs \
  --only meridian-main-zenpack84
```

### 4. Live validation checklist

- [ ] Clean boot: log contains `loaded 10 plugins (skipped 0, errors 0)`.
- [ ] Telegram responds from the new process.
- [ ] Screening cycle runs normally.
- [ ] First `0.03 SOL` receh deployment succeeds; no larger amount is used.
- [ ] Close path and vanilla two-tick confirmation work.
- [ ] Deviation #1: log shows `opportunity poll every ...` and the poller runs.
- [ ] Deviation #4: observe `dev_blocklist_error` / `Safety blocklist is
      unreadable`. The retained implementation reads local
      `dev-blocklist.json`; it has no remote-fetch call. Missing file means an
      empty blocklist, while an unreadable/corrupt existing file holds deploy
      fail-closed by design. Report the hold; do not bypass it during validation.
- [ ] Deviation #5, read-only: `jq empty gmgn-config.json` passes and logs contain
      no `gmgn-config.json tidak valid`. Do not corrupt the live file; the
      fail-closed corruption path is already fixture-tested.

Suggested non-streaming log check:

```bash
pm2 logs meridian-main-zenpack84 --lines 300 --nostream | \
  rg 'loaded 10 plugins|Cycles started|opportunity poll|dev_blocklist|Safety blocklist|gmgn-config'
```

### 5. Rollback drill

Owner commands only:

```bash
pm2 stop meridian-main-zenpack84
pm2 start 0
pm2 ls
```

Do not delete either directory or either mode-0600 backup until live validation
and rollback acceptance are complete.

## Agent stop point

The agent stops here. Starting PM2, copying `.env`, observing live money, and
executing rollback are owner-only actions.
