#!/usr/bin/env node
// Quality gate for what Clarity proposes (src/lib/suggestions.js, 1.9.0): the
// two fixed rules at their thresholds, nothing proposed twice or against what
// the person decided, and a proposal set aside that comes back — or not —
// exactly when it should.
//
// Usage: node tools/verifier-suggestions.mjs [src-folder]   (default: ../src)

import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const { suggestionsFor, dismissedAfter, fingerprint } = await import(pathToFileURL(join(SRC, 'lib', 'suggestions.js')).href);
const { orderTasks } = await import(pathToFileURL(join(SRC, 'lib', 'ordre.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); } };
const NOW = Date.parse('2026-10-15T12:00:00Z');
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const T = (id, over = {}) => ({ id, title: id, status: 'not_started', createdAt: iso(NOW - DAY), updatedAt: iso(NOW - DAY), links: [], aiData: null, ...over });
const run = (tasks, now = NOW) => suggestionsFor(orderTasks(tasks, null), now);
const kinds = (m, id) => (m.get(id) || []).map(s => s.kind + (s.value !== undefined ? ':' + s.value : '') + (s.other ? ':' + s.other : ''));

// 1. The assistant's proposals.
const ai = (over) => ({ priority: 1, priorityLevel: 'medium', suggestedLinks: [], ...over });
let m = run([T('a', { aiData: ai({ suggestedLinks: [{ to: 'b', type: 'blocks', strength: 'hard', why: 'b needs a' }], suggestedLevel: 'high', suggestedDifficulty: 4 }) }), T('b')]);
check('lien, niveau, difficulté proposés', kinds(m, 'a'), ['link:b', 'level:high', 'difficulty:4']);
check('Confirmer le lien l\'écrit sur la tâche d\'où il part', m.get('a')[0].apply, { taskId: 'a', patch: { links: [{ to: 'b', type: 'blocks', strength: 'hard' }] } });
m = run([T('a', { priority: 'low', difficulty: 2, aiData: ai({ suggestedLevel: 'high', suggestedDifficulty: 4 }) })]);
check('rien sur ce que la personne a déjà choisi', kinds(m, 'a'), []);
m = run([T('a', { aiData: ai({ suggestedLinks: [{ to: 'b', type: 'related' }] }) }), T('b', { links: [{ to: 'a', type: 'blocks', strength: 'hard' }] })]);
check('rien entre deux tâches déjà liées, dans un sens ou l\'autre', kinds(m, 'a'), []);
m = run([T('a', { aiData: ai({ suggestedLinks: [{ to: 'b', type: 'blocks' }] }) }), T('b', { links: [{ to: 'c', type: 'blocks' }] }), T('c', { links: [{ to: 'a', type: 'blocks' }] })]);
check('jamais un lien qui fermerait une boucle', kinds(m, 'a'), []);
m = run([T('a', { aiData: ai({ suggestedLinks: [{ to: 'b', type: 'blocks' }] }) }), T('b', { status: 'done' })]);
check('rien vers une tâche terminée', kinds(m, 'a'), []);

// 2. Heavy blocker, at its thresholds.
const holds = (over, held) => run([T('h', { links: [{ to: 'x', type: 'blocks', strength: 'hard' }], ...over }), T('x', held)]);
check('lourd (2 h) retient léger (30 min) : proposé', kinds(holds({ estimatedDuration: 120 }, { estimatedDuration: 30 }), 'h'), ['heavy']);
check('lourd (difficulté 4) retient léger (difficulté 2) : proposé', kinds(holds({ difficulty: 4 }, { difficulty: 2 }), 'h'), ['heavy']);
check('1 h 59 n\'est pas lourd', kinds(holds({ estimatedDuration: 119 }, { estimatedDuration: 30 }), 'h'), []);
check('31 min n\'est pas léger', kinds(holds({ estimatedDuration: 120 }, { estimatedDuration: 31 }), 'h'), []);
check('« mieux avant » ne compte pas', kinds(run([T('h', { estimatedDuration: 180, links: [{ to: 'x', type: 'blocks', strength: 'soft' }] }), T('x', { estimatedDuration: 10 })]), 'h'), []);
const hv = holds({ estimatedDuration: 150 }, { estimatedDuration: 20 }).get('h')[0];
check('« Passer en mieux avant » change la force du lien', hv.alt.patch.links, [{ to: 'x', type: 'blocks', strength: 'soft' }]);

// 3. Move down: drags, unblocks nothing, costs. Never a top chosen by the person.
const drag = (over) => run([T('d', { estimatedDuration: 180, ...over })]);
const moved = (k) => Array.from({ length: k }, (_, i) => ({ type: 'deadline', from: `2026-10-0${i + 1}`, to: `2026-10-0${i + 2}` }));
check('repoussée 3 fois : proposé de descendre d\'un cran', kinds(drag({ history: moved(3) }), 'd'), ['lower:low']);
check('repoussée 2 fois : rien', kinds(drag({ history: moved(2) }), 'd'), []);
check('intouchée 21 jours : proposé', kinds(drag({ updatedAt: iso(NOW - 21 * DAY) }), 'd'), ['lower:low']);
check('intouchée 20 jours : rien', kinds(drag({ updatedAt: iso(NOW - 20 * DAY) }), 'd'), []);
check('jamais pour une priorité absolue choisie', kinds(drag({ priority: 'top', history: moved(3) }), 'd'), []);
check('pas si elle débloque quelque chose', kinds(run([T('d', { estimatedDuration: 180, history: moved(3), links: [{ to: 'y', type: 'blocks' }] }), T('y')]), 'd'), []);
check('pas si elle ne coûte rien', kinds(drag({ estimatedDuration: 30, history: moved(3) }), 'd'), []);
check('déjà tout en bas : rien', kinds(drag({ priority: 'very_low', history: moved(3) }), 'd'), []);

// 4. Set aside: « not now » comes back on a change or after 60 days; « never » stays away.
const base = T('a', { aiData: ai({ suggestedLevel: 'high' }) });
const s = run([base]).get('a')[0];
const notNow = { ...base, dismissed: dismissedAfter(base, s, NOW) };
check('pas maintenant : caché', kinds(run([notNow]), 'a'), []);
check('… revient si la tâche change', kinds(run([{ ...notNow, title: 'a, renommée' }]), 'a'), ['level:high']);
check('… revient après 60 jours', kinds(run([notNow], NOW + 61 * DAY), 'a'), ['level:high']);
check('… pas avant', kinds(run([notNow], NOW + 59 * DAY), 'a'), []);
const never = { ...base, dismissed: dismissedAfter(base, s, NOW, true) };
check('jamais : reste caché, même changée, même après 60 jours', kinds(run([{ ...never, title: 'autre' }], NOW + 400 * DAY), 'a'), []);
check('l\'empreinte suit titre, échéance, niveau, difficulté', fingerprint({ title: 't', deadline: '2026-10-20', priority: 'low', difficulty: 3 }), 't|2026-10-20|low|3');

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`propositions — ${n} cas, aucun écart.`);
