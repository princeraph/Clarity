#!/usr/bin/env node
// Quality gate for the order of the tasks (src/lib/ordre.js, 1.8.0): what is
// blocked, what is inherited, and the sort. Every rule here is one the person
// will see — a task that should wait shown first, or a blocker left at the
// bottom while what it holds up is due tomorrow.
//
// Usage: node tools/verifier-ordre.mjs [src-folder]   (default: ../src)

import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const { orderTasks, unblockedBy, dropPlan } = await import(pathToFileURL(join(SRC, 'lib', 'ordre.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => {
  n++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); }
};
const T = (id, over = {}) => ({ id, title: id, status: 'not_started', createdAt: '2026-10-01T00:00:00Z', aiData: null, links: [], ...over });
const ids = (list) => list.filter(t => t.status !== 'done').map(t => t.id);
const blocks = (to, strength = 'hard') => ({ to, type: 'blocks', strength });
const ANALYZED = new Date('2026-10-02T00:00:00Z');
const ai = (priority, priorityLevel = 'medium') => ({ priority, priorityLevel });

// 1. The person's level comes first; the assistant orders within a level.
check('niveau de la personne avant le rang de l\'IA',
  ids(orderTasks([T('a', { aiData: ai(1) }), T('b', { aiData: ai(2), priority: 'top' }), T('c', { aiData: ai(3), priority: 'very_low' })], ANALYZED)),
  ['b', 'a', 'c']);
check('sans niveau, celui de l\'IA (haute avant moyenne)',
  ids(orderTasks([T('a', { aiData: ai(1, 'medium') }), T('b', { aiData: ai(2, 'high') })], ANALYZED)),
  ['b', 'a']);
check('même niveau : le rang de l\'IA',
  ids(orderTasks([T('a', { aiData: ai(2) }), T('b', { aiData: ai(1) })], ANALYZED)),
  ['b', 'a']);

// 2. Blocked goes under; a finished blocker blocks nothing; soft never blocks.
const chain = [T('blocker', { aiData: ai(2, 'low'), links: [blocks('held')] }), T('held', { aiData: ai(1, 'high'), priority: 'top' }), T('free', { aiData: ai(3) })];
const o = orderTasks(chain, ANALYZED);
check('une tâche bloquée passe sous les autres', ids(o), ['blocker', 'free', 'held']);
check('le bloquant hérite du niveau de ce qu\'il bloque', o.find(t => t.id === 'blocker').order.level, 'top');
check('… et dit de qui', o.find(t => t.id === 'blocker').order.inheritedFrom, 'held');
check('bloquée par', o.find(t => t.id === 'held').order.blockedBy, ['blocker']);
const doneBlocker = orderTasks([T('blocker', { status: 'done', links: [blocks('held')] }), T('held'), T('free')], ANALYZED);
check('un bloquant terminé ne bloque plus', doneBlocker.find(t => t.id === 'held').order.blocked, false);
const soft = orderTasks([T('a', { links: [blocks('b', 'soft')] }), T('b')], ANALYZED);
check('« mieux avant » ne bloque pas', soft.find(t => t.id === 'b').order.blocked, false);
check('« mieux avant » transmet quand même le niveau', orderTasks([T('a', { links: [blocks('b', 'soft')] }), T('b', { priority: 'very_high' })], ANALYZED).find(t => t.id === 'a').order.level, 'very_high');

check('une tâche terminée ne transmet plus son niveau',
  orderTasks([T('a', { links: [blocks('b')] }), T('b', { status: 'done', priority: 'top', deadline: '2026-10-03' })], ANALYZED).find(t => t.id === 'a').order.level, 'medium');

// 3. Inheritance at depth, for the level and the deadline.
const deep = orderTasks([
  T('a', { links: [blocks('b')] }), T('b', { links: [blocks('c')] }), T('c', { priority: 'top', deadline: '2026-10-18' }), T('d', { deadline: '2026-10-30' }),
], ANALYZED);
const A = deep.find(t => t.id === 'a').order;
check('héritage à deux niveaux : niveau', A.level, 'top');
check('héritage à deux niveaux : de qui', A.inheritedFrom, 'c');
check('héritage de l\'échéance la plus proche', [A.deadline, A.deadlineFor], ['2026-10-18', 'c']);
check('une échéance propre plus proche reste la sienne',
  (() => { const r = orderTasks([T('a', { deadline: '2026-10-10', links: [blocks('b')] }), T('b', { deadline: '2026-10-20' })], ANALYZED).find(t => t.id === 'a').order; return [r.deadline, r.deadlineFor]; })(),
  ['2026-10-10', null]);
check('ordre à niveau égal : échéance effective', ids(orderTasks([T('x', { deadline: '2026-11-01' }), T('y', { links: [blocks('z')] }), T('z', { deadline: '2026-10-20', links: [] })], ANALYZED)).slice(0, 2), ['y', 'x']);

// 4. New tasks lead their level until ranked; done ones go last.
check('nouvelle tâche en tête de son niveau', ids(orderTasks([T('old', { aiData: ai(1) }), T('new', { createdAt: '2026-10-05T00:00:00Z' })], ANALYZED)), ['new', 'old']);
check('les terminées à la fin', orderTasks([T('d', { status: 'done', priority: 'top' }), T('e')], ANALYZED).map(t => t.id), ['e', 'd']);

// 5. Related, both ways; a link to a missing task is ignored; a loop does not hang.
const rel = orderTasks([T('a', { links: [{ to: 'b', type: 'related' }, { to: 'ghost', type: 'blocks' }] }), T('b')], ANALYZED);
check('« liée à » se lit des deux côtés', rel.find(t => t.id === 'b').order.related, ['a']);
check('un lien vers une tâche disparue est ignoré', rel.find(t => t.id === 'a').order.blocks, []);
const loop = orderTasks([T('a', { links: [blocks('b')] }), T('b', { links: [blocks('a')] })], ANALYZED);
check('une boucle passée par la synchro ne bloque pas le calcul', loop.length, 2);

// 6. What finishing a task sets free.
check('terminer le seul bloquant libère', unblockedBy([T('a', { links: [blocks('b')] }), T('b')], 'a'), ['b']);
check('un autre bloquant reste : pas libérée', unblockedBy([T('a', { links: [blocks('c')] }), T('b', { links: [blocks('c')] }), T('c')], 'a'), []);
check('« mieux avant » ne compte pas', unblockedBy([T('a', { links: [blocks('b', 'soft')] }), T('b')], 'a'), []);


// 2.4.0 — the order given by hand.
check('rang donné à la main : dans le niveau, avant le rang de l\'IA', ids(orderTasks([T('a', { aiData: ai(1) }), T('b', { aiData: ai(2), rank: 10 }), T('c', { aiData: ai(3), rank: 20 })], ANALYZED)), ['b', 'c', 'a']);
check('… même contre le rang de l\'IA', ids(orderTasks([T('b', { aiData: ai(2), rank: 20 }), T('c', { aiData: ai(3), rank: 10 })], ANALYZED)), ['c', 'b']);
check('… le rang ne franchit pas les niveaux', ids(orderTasks([T('a', { priority: 'high' }), T('b', { priority: 'low', rank: 10 })], ANALYZED)), ['a', 'b']);
check('… ni un blocage', ids(orderTasks([T('a', { links: [blocks('b')], rank: 20 }), T('b', { rank: 10 })], ANALYZED)), ['a', 'b']);
check('… une tâche nouvelle mène encore son niveau', ids(orderTasks([T('a', { rank: 10 }), T('n', { createdAt: '2026-10-05T00:00:00Z' })], ANALYZED)), ['n', 'a']);
check('… sans assistant, placée à la main, elle n\'est plus « nouvelle »', ids(orderTasks([T('a', { rank: 20, createdAt: '2026-10-05T00:00:00Z' }), T('b', { rank: 10 })], null)), ['b', 'a']);
const L = orderTasks([T('a', { priority: 'high' }), T('b', { priority: 'high' }), T('c', { priority: 'medium' }), T('d', { priority: 'medium' })], ANALYZED);
check('glisser « b » en tête de son niveau : rangs de tout le niveau', dropPlan(L, 'b', 0), { updates: [{ id: 'b', rank: 10 }, { id: 'a', rank: 20 }], level: 'high', note: null });
check('glisser « a » entre « c » et « d » : il prend leur niveau', dropPlan(L, 'a', 2).updates[0], { id: 'a', priority: 'medium', rank: 20 });
check('… à la frontière, il garde le sien (et passe devant « c »)', dropPlan(L, 'd', 2), { updates: [{ id: 'd', rank: 10 }, { id: 'c', rank: 20 }], level: 'medium', note: null });
check('… à la frontière, d\'un troisième niveau : celui du dessus', dropPlan([...L, ...orderTasks([T('z', { priority: 'low' })], ANALYZED)], 'z', 2).level, 'high');
check('rien ne bouge : aucun envoi', dropPlan(orderTasks([T('a', { priority: 'high', rank: 10 }), T('b', { priority: 'high', rank: 20 })], ANALYZED), 'a', 0).updates, []);
const LB = orderTasks([T('x', { links: [blocks('y')] }), T('y')], ANALYZED);
check('une tâche bloquée glissée au-dessus de ce qui la bloque : dit', dropPlan(LB, 'y', 0).note, 'blocked');

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`ordre des tâches — ${n} cas, aucun écart.`);
