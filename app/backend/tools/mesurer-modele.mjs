#!/usr/bin/env node
// Mesurer avant de corriger.
//
// Ollama renvoie ses propres chronos avec chaque réponse — load_duration,
// prompt_eval_duration, eval_duration — donc rien ici n'est estimé. On sépare
// les trois choses qu'on confond quand on dit « c'est lent » :
//
//   CHARGEMENT  le modèle n'était pas en mémoire. Payé une fois, puis à chaque
//               fois si keep_alive laisse Ollama le décharger.
//   LECTURE     le temps de lire le prompt. Croît avec sa taille.
//   ÉCRITURE    le temps de produire la réponse. Croît avec sa LONGUEUR, et
//               c'est presque toujours là que passe le temps.
//
// Lancer depuis projet-clarity/app/backend :
//     node tools/mesurer-modele.mjs
//     node tools/mesurer-modele.mjs --froid    (décharge d'abord, pour voir le coût réel d'un chargement)

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA = process.env.CLARITY_DATA_DIR
  || join(process.env.APPDATA || process.env.HOME || '.', 'clarity', 'data');
const settingsPath = join(DATA, 'settings.json');
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {};
const ENDPOINT = process.env.CLARITY_ENDPOINT || settings.llmEndpoint || 'http://localhost:11434';
const MODEL    = process.env.CLARITY_MODEL    || settings.ollamaModel  || 'gemma4:latest';
const COLD     = process.argv.includes('--froid') || process.argv.includes('--cold');

const ms = (ns) => Math.round((ns || 0) / 1e6);
const pad = (s, n) => String(s).padStart(n);

async function call(prompt, { maxTokens, keepAlive = '30m', numCtx = 4096 }) {
  const t0 = Date.now();
  const resp = await fetch(`${ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, prompt, stream: false, keep_alive: keepAlive,
      options: { temperature: 0.2, num_predict: maxTokens, num_ctx: numCtx },
    }),
    signal: AbortSignal.timeout(600000),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text().catch(() => '')}`);
  const r = await resp.json();
  return {
    wall: Date.now() - t0,
    load: ms(r.load_duration),
    read: ms(r.prompt_eval_duration),
    readTokens: r.prompt_eval_count || 0,
    write: ms(r.eval_duration),
    writeTokens: r.eval_count || 0,
  };
}

function line(label, r) {
  const tps = r.write > 0 ? (r.writeTokens / (r.write / 1000)).toFixed(1) : '—';
  console.log(
    `  ${label.padEnd(26)} ${pad(r.wall, 7)} ms   ` +
    `chargement ${pad(r.load, 6)}   lecture ${pad(r.read, 6)} (${pad(r.readTokens, 5)} t)   ` +
    `écriture ${pad(r.write, 6)} (${pad(r.writeTokens, 4)} t, ${pad(tps, 5)} t/s)`
  );
}

// Un prompt de la taille de celui que Clarity envoie pour son analyse.
const analysisLike = (n) => Array.from({ length: n }, (_, i) =>
  `Task ${i + 1}:\nID: id-${i}\nTitle: Une tâche au titre plausible ${i}\n` +
  `Description: Un peu de contexte écrit par la personne sur ce que ça implique.\n` +
  `Deadline: 2026-09-20\nStatus: not_started\nTags: travail\nNotes: Deux phrases de détail.`
).join('\n\n');

console.log(`\nmodèle : ${MODEL}   endpoint : ${ENDPOINT}\n`);

try {
  if (COLD) {
    console.log('déchargement du modèle…');
    await call('', { maxTokens: 1, keepAlive: '0' });
    await new Promise(r => setTimeout(r, 1500));
    console.log('');
  }

  console.log('à froid ou tiède, selon ce qui précède :');
  line('réponse courte', await call('Réponds par un seul mot : bonjour.', { maxTokens: 20 }));

  console.log('\nune fois le modèle chaud :');
  line('réponse courte', await call('Réponds par un seul mot : bonjour.', { maxTokens: 20 }));
  line('prompt long, sortie courte', await call(analysisLike(20) + '\n\nRéponds par OK.', { maxTokens: 20, numCtx: 8192 }));
  line('prompt court, sortie longue', await call('Écris un paragraphe sur le fait de planifier sa journée.', { maxTokens: 400 }));

  console.log(`
Comment lire :
  · « chargement » non nul sur la première ligne et nul ensuite = keep_alive fait son travail.
    S'il revient à chaque appel, le modèle est déchargé entre-temps.
  · comparer les deux dernières lignes : si « sortie longue » coûte bien plus que
    « prompt long », le temps est dans l'ÉCRITURE. Raccourcir ce qu'on demande au
    modèle vaut mieux que raccourcir ce qu'on lui donne.
  · en dessous d'environ 10 t/s, aucun réglage ne sauvera l'attente : c'est le
    modèle qui est trop gros pour la machine.
`);
} catch (err) {
  console.error(`\nimpossible de mesurer : ${err.message}`);
  console.error(`Ollama tourne-t-il ? (ollama serve)  Le modèle « ${MODEL} » est-il installé ? (ollama list)\n`);
  process.exit(1);
}
