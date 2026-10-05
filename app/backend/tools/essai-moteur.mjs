// Proves the built-in assistant end to end on a real GGUF: the engine process
// starts, loads the model, streams text, and writes JSON under a schema.
// The CI runs it on a 1 MB model, where the answer is nonsense and the
// plumbing is everything that is being checked.
//
// Usage: node tools/essai-moteur.mjs <models folder>

import { LocalProvider, unloadAll } from '../src/llm/LocalProvider.js';

const modelsDir = process.argv[2];
const p = new LocalProvider({ modelsDir });
if (!(await p.ping())) { console.error(`no .gguf model in ${modelsDir}`); process.exit(1); }

let started = Date.now(), text = '';
for await (const t of p.generate('Once upon a time', { maxTokens: 24 })) text += t;
if (!text.trim()) { console.error('the engine streamed nothing'); process.exit(1); }
console.log(`texte en ${Date.now() - started} ms : ${JSON.stringify(text.slice(0, 60))}`);

started = Date.now();
const schema = { type: 'array', items: { type: 'string', maxLength: 20 }, minItems: 1, maxItems: 2 };
const json = await p.generateJSON('List two things.', { maxTokens: 40, schema });
if (!Array.isArray(json) || !json.length) { console.error(`JSON outside the schema: ${JSON.stringify(json)}`); process.exit(1); }
console.log(`JSON en ${Date.now() - started} ms : ${JSON.stringify(json)}`);

await unloadAll();
