export const manifest = { priority: 10 };
export function register(hooks) { hooks.on("boot", () => globalThis.__order.push("first")); }
