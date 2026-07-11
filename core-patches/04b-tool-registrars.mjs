// Patch 04b: registrar runtime untuk tool LLM — ADDITIVE murni via appendPatch EOF
// (nol baris existing berubah; function declaration di EOF tetap menjangkau module scope,
// jadi tidak butuh anchor penutup `};`/`];` yang tidak unik).
// KONTEKS Fase 0.4: definitions.js:1116 `export const tools = toolDefinitions.map(...)`
// = transform SEKALI saat module load, TAPI agent.js filter array `tools` PER-PANGGILAN
// (getToolsForRole) → registrar wajib push ke KEDUA array; entri `tools` memakai mirror
// transform persis definitions.js:1116-1124 (additionalProperties: false utk schema object).
// JEBAKAN ESM: static import jalan SEBELUM loadPlugins() → registrasi lewat pemanggilan
// registrar di register() plugin saat runtime, bukan hook module-load.

const executorInject = `export function zenpackRegisterTool(name, fn) { toolMap[name] = fn; }`;

const definitionsInject = `export function zenpackRegisterToolDef(def) {
  toolDefinitions.push(def);
  tools.push({
    ...def,
    function: {
      ...def.function,
      parameters: def.function.parameters?.type === "object"
        ? { additionalProperties: false, ...def.function.parameters }
        : def.function.parameters,
    },
  });
}`;

export default [
  { file: "tools/executor.js",    marker: "zen-pack:04b-tool-registrar",     append: executorInject },
  { file: "tools/definitions.js", marker: "zen-pack:04b-tooldef-registrar",  append: definitionsInject },
];
