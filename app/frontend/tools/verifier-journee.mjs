#!/usr/bin/env node
// Quality gate for the realistic day (src/lib/journee.js, 2.0.0): what the day
// holds, how long tasks really take, the plan, and how it moves when the day
// overruns. Each rule here is one the person feels — a plan that promises more
// than the day holds is the very problem this answers.
//
// Usage: node tools/verifier-journee.mjs [src-folder]   (default: ../src)

import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const J = await import(pathToFileURL(join(SRC, 'lib', 'journee.js')).href);
const { orderTasks } = await import(pathToFileURL(join(SRC, 'lib', 'ordre.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); } };
const TODAY = '2026-10-16';                       // a Friday
const DAY = { start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00', days: [1, 2, 3, 4, 5] };
const T = (id, over = {}) => ({ id, title: id, status: 'not_started', deadline: TODAY, createdAt: '2026-10-01T00:00:00Z', links: [], aiData: null, ...over });
const plan = (tasks, over = {}) => J.buildPlan({ tasks: orderTasks(tasks, null), today: TODAY, nowMin: J.toMin('09:00'), workday: DAY, ...over });
const at = (p, id) => { const b = p.blocks.find(b => b.taskIds.includes(id)); return b ? `${J.toHHMM(b.start)}-${J.toHHMM(b.end)}` : null; };

// 1. What the day holds.
check('capacité : 9 h – 18 h moins la pause', J.freeIntervals({ workday: DAY, nowMin: 0 }).map(([s, e]) => [J.toHHMM(s), J.toHHMM(e)]), [['09:00', '12:00'], ['13:00', '18:00']]);
check('… moins un rendez-vous', J.freeIntervals({ workday: DAY, nowMin: 0, taken: [{ start: J.toMin('10:00'), end: J.toMin('11:00') }] }).length, 3);
check('… à partir de maintenant, arrondi aux 5 min', J.toHHMM(J.freeIntervals({ workday: DAY, nowMin: J.toMin('14:12') })[0][0]), '14:15');
check('sans pause', J.freeIntervals({ workday: { ...DAY, breakStart: null, breakEnd: null }, nowMin: 0 }).length, 1);

// 2. How long it really takes.
check('estimation × écart du sujet', J.plannedMinutes({ estimatedDuration: 60, tags: ['travail'] }, { overall: 1.1, byArea: { travail: 1.3 } }), { base: 60, factor: 1.3, minutes: 80 });
check('… sinon l\'écart général', J.plannedMinutes({ estimatedDuration: 60, tags: ['maison'] }, { overall: 1.5, byArea: { travail: 1.3 } }).minutes, 90);
check('… sinon tel quel', J.plannedMinutes({ estimatedDuration: 45 }).minutes, 45);
check('sans estimation : d\'après la difficulté (4 → 2 h)', J.plannedMinutes({ difficulty: 4 }).minutes, 120);
check('ni l\'une ni l\'autre : 30 min', J.plannedMinutes({}).minutes, 30);
check('un écart démesuré est borné (×3 au plus)', J.plannedMinutes({ estimatedDuration: 60 }, { overall: 9 }).minutes, 180);

// 3. The plan.
let p = plan([T('a', { estimatedDuration: 60 }), T('b', { estimatedDuration: 60 })]);
check('dans l\'ordre, à la suite', [at(p, 'a'), at(p, 'b')], ['09:00-10:00', '10:00-11:00']);
p = plan([T('a', { estimatedDuration: 60 })], { events: [{ start: J.toMin('09:00'), end: J.toMin('09:30'), label: 'Réunion' }] });
check('autour d\'un rendez-vous', at(p, 'a'), '09:30-10:30');
p = plan([T('fix', { time: '10:00', estimatedDuration: 60 }), T('a', { estimatedDuration: 90 })]);
// 90 min do not fit before 10:00 (60) nor between 11:00 and the break (60).
check('une heure fixée reste, le reste l\'évite', [at(p, 'fix'), at(p, 'a')], ['10:00-11:00', '13:00-14:30']);
p = plan([T('hard', { estimatedDuration: 60, difficulty: 5 })], { peakHour: 15 });
check('difficile : à l\'heure où l\'on termine le plus', at(p, 'hard'), '15:00-16:00');
p = plan([T('hard', { estimatedDuration: 60, difficulty: 5 })]);
check('difficile sans rythme connu : le matin', at(p, 'hard'), '09:00-10:00');
p = plan([T('s1', { estimatedDuration: 10 }), T('big', { estimatedDuration: 60 }), T('s2', { estimatedDuration: 15 })]);
const batch = p.blocks.find(b => b.kind === 'batch');
check('les petites tâches du jour, en un bloc', [batch?.taskIds, batch && J.toHHMM(batch.start), batch && batch.end - batch.start], [['s1', 's2'], '09:00', 25]);
p = plan([T('x1', { tags: ['travail'] }), T('y', { tags: ['maison'] }), T('x2', { tags: ['travail'] })]);
check('même sujet : l\'une après l\'autre', p.blocks.map(b => b.taskIds[0]), ['x1', 'x2', 'y']);
p = plan([T('held', { estimatedDuration: 30, priority: 'top' }), T('blocker', { estimatedDuration: 60, links: [{ to: 'held', type: 'blocks', strength: 'hard' }] })]);
check('jamais avant ce qui la bloque', [at(p, 'blocker'), at(p, 'held')], ['09:00-10:00', '10:00-10:30']);
p = plan([T('held', { estimatedDuration: 30 }), T('blocker', { deadline: '2026-10-20', estimatedDuration: 600, links: [{ to: 'held', type: 'blocks', strength: 'hard' }] })]);
check('bloquée par une tâche absente du jour : ne tient pas, et dit par qui', p.overflow.map(o => [o.taskId, o.reason, o.by]), [['held', 'blocked', 'blocker']]);

// 4. What does not fit, and why.
p = plan([T('a', { estimatedDuration: 300 }), T('b', { estimatedDuration: 300 })]);
check('la journée est pleine : la seconde ne tient pas', [at(p, 'a'), p.overflow.map(o => [o.taskId, o.reason])], ['13:00-18:00', [['b', 'full']]]);
check('… et de combien', [p.capacity, p.missing], [480, 300]);
p = plan([T('due'), T('later', { deadline: '2026-10-22', estimatedDuration: 600 })]);
check('ce qui n\'était pas pour aujourd\'hui ne compte pas comme « ne tient pas »', p.overflow, []);
p = plan([T('due', { estimatedDuration: 60 }), T('later', { deadline: '2026-10-22', estimatedDuration: 60 })]);
check('ce qui vient ensuite remplit le reste', [at(p, 'due'), at(p, 'later')], ['09:00-10:00', '10:00-11:00']);
check('passer à demain un vendredi : lundi', J.nextWorkday(TODAY, DAY.days), '2026-10-19');

// 5. When the day overruns.
const tasks = [T('a', { estimatedDuration: 60 }), T('b', { estimatedDuration: 60 }), T('c', { estimatedDuration: 60 })];
const accepted = plan(tasks);
const args = (nowMin, over = tasks) => ({ tasks: orderTasks(over, null), today: TODAY, nowMin, workday: DAY });
const done = (ids) => new Set(ids);
check('dans les temps : rien à bouger', J.needsReplan(accepted, J.toMin('09:30'), done([])), false);
check('« a » finie à l\'heure : rien à bouger', J.needsReplan(accepted, J.toMin('10:05'), done(['a'])), false);
check('« a » pas finie à 10 h 03 : quelques minutes de grâce, rien ne bouge', J.needsReplan(accepted, J.toMin('10:03'), done([])), false);
check('« a » pas finie à 10 h 25 : le plan doit bouger', J.needsReplan(accepted, J.toMin('10:25'), done([])), true);
check('« a » finie en avance, encore en cours à l\'horloge : son temps se libère', J.needsReplan(accepted, J.toMin('09:40'), done(['a'])), true);
let r = J.replan(accepted, args(J.toMin('10:25')));
// « b » is in progress by the clock, but « a » is not finished: the person is still on « a ».
check('… la suite part de maintenant, dans le même ordre', r.plan.blocks.map(b => [b.taskIds[0], J.toHHMM(b.start)]), [['a', '10:25'], ['b', '13:00'], ['c', '14:00']]);
check('… et dit de combien', r.shift, 180);
const withDone = tasks.map(t => t.id === 'c' ? { ...t, status: 'done' } : t);
check('« c » finie avant son heure : son temps se libère', J.needsReplan(accepted, J.toMin('09:30'), done(['c'])), true);
r = J.replan(accepted, args(J.toMin('09:40'), tasks.map(t => t.id === 'a' ? { ...t, status: 'done' } : t)));
check('… « b » remonte à maintenant', r.plan.blocks.map(b => [b.taskIds[0], J.toHHMM(b.start)]), [['b', '09:40'], ['c', '10:40']]);
r = J.replan(accepted, args(J.toMin('09:30'), withDone));
check('… le bloc en cours ne bouge pas, « c » disparaît', r.plan.blocks.map(b => [b.taskIds[0], J.toHHMM(b.start)]), [['a', '09:00'], ['b', '10:00']]);
check('maintenant / ensuite', (() => { const { now, next } = J.nowAndNext(accepted, J.toMin('09:40')); return [now?.taskIds[0], next?.taskIds[0]]; })(), ['a', 'b']);


// 2.1.0 — the time grid.
const L = (items, over = {}) => J.layoutDay({ items: items.map(([id, a, b]) => ({ id, start: J.toMin(a), end: J.toMin(b) })), ...over });
const lanes = (l) => l.items.map(i => `${i.id}:${i.lane}/${i.lanes}`);
check('grille : sans chevauchement, une seule colonne', lanes(L([['a', '09:00', '10:00'], ['b', '10:00', '11:00']])), ['a:0/1', 'b:0/1']);
check('grille : deux qui se chevauchent, côte à côte', lanes(L([['a', '09:00', '10:30'], ['b', '10:00', '11:00']])), ['a:0/2', 'b:1/2']);
check('grille : la place libérée est reprise', lanes(L([['a', '09:00', '12:00'], ['b', '09:00', '10:00'], ['c', '10:00', '11:00']])), ['a:0/2', 'b:1/2', 'c:1/2']);
check('grille : un groupe qui se chevauche ne rétrécit pas le suivant', lanes(L([['a', '09:00', '10:00'], ['b', '09:30', '10:00'], ['c', '14:00', '15:00']])), ['a:0/2', 'b:1/2', 'c:0/1']);
check('grille : heures entières qui contiennent la journée', (({ from, to }) => [J.toHHMM(from), J.toHHMM(to)])(L([], { workday: DAY })), ['09:00', '18:00']);
check('grille : … et ce qui en dépasse', (({ from, to }) => [J.toHHMM(from), J.toHHMM(to)])(L([['tôt', '07:30', '08:00'], ['tard', '18:00', '19:10']], { workday: DAY })), ['07:00', '20:00']);
check('pauses de la journée', J.breaksOf(DAY).map(b => [J.toHHMM(b.start), J.toHHMM(b.end)]), [['12:00', '13:00']]);
check('… sans pause, aucune', J.breaksOf({ ...DAY, breakStart: null, breakEnd: null }), []);


// 2.2.0 — several breaks, hours by day, and the person's own changes.
const DAY2 = { start: '09:00', end: '18:00', breaks: [{ start: '10:30', end: '10:45', label: 'Café' }, { start: '12:00', end: '13:00' }], days: [1, 2, 3, 4, 5],
  byDay: { 5: { start: '09:00', end: '13:00', breaks: [] }, 1: { start: '08:00', end: '17:00', breaks: [{ start: '11:30', end: '12:15' }] } } };
check('plusieurs pauses : chacune retirée de la journée', J.freeIntervals({ workday: { ...DAY2, byDay: undefined }, nowMin: 0 }).map(([a, b]) => `${J.toHHMM(a)}-${J.toHHMM(b)}`), ['09:00-10:30', '10:45-12:00', '13:00-18:00']);
check('heures du jour : le vendredi a les siennes', J.hoursOf(DAY2, 5), { start: '09:00', end: '13:00', breaks: [], days: [1, 2, 3, 4, 5] });
check('… le lundi aussi, avec sa pause', J.breaksOf(J.hoursOf(DAY2, 1)).map(b => J.toHHMM(b.start)), ['11:30']);
check('… le mardi : les heures communes', J.hoursOf(DAY2, 2).breaks.length, 2);
check('… le samedi : pas travaillé', J.hoursOf(DAY2, 6), null);
check('l\'ancienne forme (une pause) se lit encore', J.breaksOf(J.hoursOf(DAY, 2)).map(b => [J.toHHMM(b.start), J.toHHMM(b.end)]), [['12:00', '13:00']]);
const H = J.hoursOf(DAY2, 5);                                   // the Friday: 9 to 13, no break
const two = [T('a', { estimatedDuration: 60 }), T('b', { estimatedDuration: 60 }), T('c', { estimatedDuration: 60 })];
check('le plan suit les heures du jour : 4 h le vendredi', plan(two, { workday: H }).capacity, 240);
let pe = plan(two, { workday: DAY, edits: { pins: { c: J.toMin('09:00') } } });
check('épingler « c » à 9 h : il y est, les autres autour', [at(pe, 'c'), at(pe, 'a'), at(pe, 'b')], ['09:00-10:00', '10:00-11:00', '11:00-12:00']);
check('… marqué épinglé', pe.blocks.find(b => b.taskIds[0] === 'c').pinned, true);
pe = plan(two, { workday: DAY, edits: { durations: { a: 25 } } });
check('changer une durée : 25 min aujourd\'hui, sans écart appliqué', [at(pe, 'a'), pe.blocks.find(b => b.taskIds[0] === 'a').factor], ['09:00-09:25', 1]);
pe = plan(two, { workday: DAY, edits: { excluded: ['a'] } });
check('retirer du jour : absent du plan et de ce qui ne tient pas', [at(pe, 'a'), pe.overflow.some(o => o.taskId === 'a'), at(pe, 'b')], [null, false, '09:00-10:00']);
pe = plan([...two, T('d', { deadline: '2026-10-30', estimatedDuration: 30 })], { workday: DAY, edits: { included: ['d'] } });
check('ajouter une tâche d\'un autre jour : placée avec celles du jour', [at(pe, 'd'), pe.overflow.length], ['13:00-13:30', 0]);
pe = plan([T('a', { estimatedDuration: 60 }), T('e', { deadline: '2026-10-20', priority: 'top', estimatedDuration: 30 }), T('d', { deadline: '2026-10-30', priority: 'low', estimatedDuration: 30 })], { workday: DAY, edits: { included: ['d'] } });
check('… avant une tâche plus haute mais pas pour aujourd\'hui', [at(pe, 'd'), at(pe, 'e')], ['10:00-10:30', '10:30-11:00']);
pe = plan(two, { workday: DAY, edits: { breaks: [{ start: J.toMin('10:00'), end: J.toMin('10:30') }] } });
check('ajouter une pause aujourd\'hui : la suite passe après', [at(pe, 'a'), at(pe, 'b'), pe.blocks.some(b => b.kind === 'pause')], ['09:00-10:00', '10:30-11:30', true]);
const smalls = [T('s1', { estimatedDuration: 10 }), T('s2', { estimatedDuration: 10 })];
check('défaire le groupe des petites tâches', [plan(smalls).blocks.map(b => b.kind).join(), plan(smalls, { edits: { ungrouped: true } }).blocks.map(b => b.kind).join()], ['batch', 'task,task']);
{
  const ts = orderTasks(two, null);
  const edits = { pins: { c: J.toMin('11:00') } };
  const accepted = J.buildPlan({ tasks: ts, today: TODAY, nowMin: J.toMin('09:00'), workday: DAY, edits });
  const r = J.replan(accepted, { tasks: ts, today: TODAY, nowMin: J.toMin('10:30'), workday: DAY, edits });
  check('la journée déborde : l\'épinglé ne bouge pas, le reste glisse autour', [at(r.plan, 'c'), at(r.plan, 'a'), at(r.plan, 'b')], ['11:00-12:00', '13:00-14:00', '14:00-15:00']);
}
check('maintenant / ensuite : un bloc épinglé compte', (() => { const p = plan(two, { workday: DAY, edits: { pins: { c: J.toMin('09:00') } } }); return J.nowAndNext(p, J.toMin('09:10')).now?.taskIds[0]; })(), 'c');

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`journée réaliste — ${n} cas, aucun écart.`);
