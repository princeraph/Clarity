// The built-in assistant's engine runs here, in a process of its own.
//
// llama.cpp is native code holding 3 to 5 GB. When it fails it does not throw:
// it aborts the process. Measured on 5 October — on a CPU with AMX, under
// Electron's Node, loading the model killed the process with an illegal
// instruction. In the backend's own process that took the task store and every
// route down with it, and nothing restarts the backend. Here it takes down
// only this worker: the request fails with a message, the next one starts a
// fresh worker.
//
// Protocol (IPC, JSON): in  — load {modelPath}, run {id, req}, abort {id}, dispose
//                       out — ready {gpu}, failed {message}, text {id, text},
//                             done {id, text}, error {id, message}

import { loadLlamaEngine } from './LocalProvider.js';

let engine = null;
const running = new Map();   // id → AbortController

// The backend is gone: nothing will ever read what this process produces.
process.on('disconnect', () => process.exit(0));

process.on('message', async (msg) => {
  if (msg?.type === 'load') {
    try {
      engine = await loadLlamaEngine(msg.modelPath);
      process.send({ type: 'ready', gpu: engine.gpu });
    } catch (err) {
      process.send({ type: 'failed', message: err.message });
    }
  } else if (msg?.type === 'run') {
    const stop = new AbortController();
    running.set(msg.id, stop);
    try {
      const text = await engine.run({ ...msg.req, signal: stop.signal,
        onText: (t) => process.send({ type: 'text', id: msg.id, text: t }) });
      process.send({ type: 'done', id: msg.id, text });
    } catch (err) {
      process.send({ type: 'error', id: msg.id, message: err?.message || String(err) });
    } finally {
      running.delete(msg.id);
    }
  } else if (msg?.type === 'abort') {
    running.get(msg.id)?.abort(new Error('aborted'));
  } else if (msg?.type === 'dispose') {
    await engine?.dispose().catch(() => {});
    process.exit(0);
  }
});
