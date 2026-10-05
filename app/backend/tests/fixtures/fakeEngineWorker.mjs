// Stands in for engineWorker.js: same protocol, no model. A prompt of 'crash'
// ends the process the way a native abort would.
process.on('disconnect', () => process.exit(0));
process.on('message', (msg) => {
  if (msg.type === 'load') {
    if (msg.modelPath.endsWith('fige.gguf')) return;   // never ready: a stuck load
    if (msg.modelPath.endsWith('cassé.gguf')) process.send({ type: 'failed', message: 'not a model' });
    else process.send({ type: 'ready', gpu: false });
  } else if (msg.type === 'run') {
    if (msg.req.prompt === 'crash') process.exit(134);
    if (msg.req.prompt === 'slow') return;   // never answers: only an abort ends it
    for (const t of ['Bon', 'jour']) process.send({ type: 'text', id: msg.id, text: t });
    process.send({ type: 'done', id: msg.id, text: 'Bonjour' });
  } else if (msg.type === 'abort') {
    process.send({ type: 'error', id: msg.id, message: 'aborted' });
  } else if (msg.type === 'dispose') process.exit(0);
});
