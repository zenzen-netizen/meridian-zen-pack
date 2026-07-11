export const manifest = { priority: 200 };
export function register(hooks) { hooks.on("boot", () => globalThis.__order.push("second")); }
