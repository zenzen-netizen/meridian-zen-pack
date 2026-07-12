// Patch 07: balikin FAIL-OPEN di token-blacklist.js load().
// Vanilla-main: JSON korup → log + throw ("Safety blacklist is unreadable") →
// bot BERHENTI (fail-closed). Fork + yunus-experimental: `catch { return {}; }`
// → jalan tanpa blacklist (fail-open). Target: perilaku = fork.
// replaceLine = src.replace(old,new) exact-substring, MULTILINE-SAFE — blok catch
// utuh 1 replace (old unik, count=1). Backtick + ${} di-escape agar old = literal.
// Routing BLACKLIST_FILE→paths.* sudah patch 02 — JANGAN sentuh.
const M = "zen-pack:07-blacklist-failopen";

export default [
  { file: "token-blacklist.js", marker: M, replaces: [
    { old: `  } catch (error) {
    log("blacklist_error", \`Invalid \${BLACKLIST_FILE}: \${error.message}\`);
    throw new Error(\`Safety blacklist is unreadable: \${BLACKLIST_FILE}\`);
  }`,
      new: `  } catch { // [zen-pack:07] fail-open — match fork/experimental
    return {};
  }` },
  ]},
];
