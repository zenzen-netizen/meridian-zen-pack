// Fixture pembuktian pipeline hook: satu-satunya plugin ber-register() di Stage 3.1.
// Kontrak loader (zenpack-lib/loader.js): export register(hooks); manifest.priority kecil = duluan.
export const manifest = { name: "zenpack-hello", priority: 10 };

export function register(hooks) {
  console.log("[zen-pack] hello plugin registered");
  hooks.on("zenpack:hello", (ctx) => { ctx.meta = { ...ctx.meta, hello: true }; }, 10);
}
