// Proves the built-in assistant end to end on a real GGUF: the engine starts,
// loads the model, streams text, and writes JSON under a schema. The CI runs it
// on a small model, where the answer is nonsense and the plumbing is
// everything that is being checked.
//
// Usage: node tools/essai-moteur.mjs <models folder> [--direct]
//   --direct  runs the engine in this process instead of its worker — to tell
//             a fault of the engine from a fault of the process around it.

import { LocalProvider, loadLlamaEngine, unloadAll } from '../src/llm/LocalProvider.js';

const modelsDir = process.argv[2];
const direct = process.argv.includes('--direct');
const p = new LocalProvider({ modelsDir, ...(direct ? { loadEngine: (m) => loadLlamaEngine(m) } : {}) });
if (!(await p.ping())) { console.error(`no .gguf model in ${modelsDir}`); process.exit(1); }
const mode = `${direct ? 'direct' : 'processus'}, ${process.env.CLARITY_LLAMA_THREADS || 'défaut'} fils, ${(await import('os')).cpus().length} cœurs`;

async function timed(label, gen) {
  const start = Date.now(); const at = []; let text = '';
  try { for await (const t of gen) { at.push(Date.now() - start); text += t; } }
  catch (err) {
    console.error(`[${mode}] ${label} : ÉCHEC après ${Date.now() - start} ms, ${at.length} morceaux reçus (instants : ${at.slice(0, 30).join(', ')}) — ${err.message}`);
    process.exit(1);
  }
  const gaps = at.slice(1).map((v, i) => v - at[i]);
  console.log(`[${mode}] ${label} : ${at.length} morceaux en ${Date.now() - start} ms, premier à ${at[0]} ms, plus long écart ${Math.max(0, ...gaps)} ms — ${JSON.stringify(text.slice(0, 50))}`);
  if (!text.trim()) { console.error('the engine streamed nothing'); process.exit(1); }
}

const timeout = 60000;
const w = await p.warm();
console.log(`[${mode}] chargé en ${w.ms} ms sur ${w.gpu}${w.error ? ' — ' + w.error : ''}`);
await timed('texte court', p.generate('Once upon a time', { maxTokens: 24, timeout }));
// About the size of Clarity's real chat system prompt.
const system = 'You are Clarity, a calm task assistant. '.repeat(80);
await timed('discussion longue', p.generateChat(system, [{ role: 'user', content: 'Hello, where do I start?' }], { maxTokens: 64, timeout }));

const started = Date.now();
const schema = { type: 'array', items: { type: 'string', maxLength: 20 }, minItems: 1, maxItems: 2 };
const json = await p.generateJSON('List two things.', { maxTokens: 40, schema, timeout });
if (!Array.isArray(json) || !json.length) { console.error(`JSON outside the schema: ${JSON.stringify(json)}`); process.exit(1); }
console.log(`[${mode}] JSON en ${Date.now() - started} ms : ${JSON.stringify(json)}`);

await unloadAll();
