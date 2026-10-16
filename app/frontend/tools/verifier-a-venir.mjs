#!/usr/bin/env node
// « Upcoming » (src/lib/avenir.js, 2.1.0): the days ahead, one by one, and
// whether each can hold what is due. Usage: node tools/verifier-a-venir.mjs [src-folder]
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const A = await import(pathToFileURL(join(SRC, 'lib', 'avenir.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); } };
const TODAY = '2026-10-16';                       // a Friday
const DAY = { start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00', days: [1, 2, 3, 4, 5] };
const T = (id, deadline, over = {}) => ({ id, title: id, status: 'not_started', deadline, estimatedDuration: 60, ...over });
const up = (tasks, over = {}) => A.upcoming({ tasks, today: TODAY, workday: DAY, ...over });

check('demain, puis les jours suivants', A.addDays(TODAY, 1) + ' ' + A.addDays(TODAY, 16), '2026-10-17 2026-11-01');
check('jour de la semaine', A.weekday('2026-10-19'), 1);
check('un jour travaillé : 8 h libres', A.dayCapacity('2026-10-19', DAY), 480);
check('… moins un rendez-vous', A.dayCapacity('2026-10-19', DAY, [{ start: 600, end: 660 }]), 420);
check('… un rendez-vous pendant la pause ne compte pas deux fois', A.dayCapacity('2026-10-19', DAY, [{ start: 720, end: 780 }]), 480);
check('… un rendez-vous hors des heures ne compte pas', A.dayCapacity('2026-10-19', DAY, [{ start: 1140, end: 1200 }]), 480);
check('un jour non travaillé : 0', A.dayCapacity('2026-10-17', DAY), 0);

const tasks = [T('a', '2026-10-19'), T('b', '2026-10-19', { estimatedDuration: 30 }), T('c', '2026-10-21'), T('d', '2026-10-16'), T('e', '2026-10-30'), T('f', null), T('g', '2026-10-19', { status: 'done' })];
let r = up(tasks);
check('jours vides masqués, aujourd\'hui exclu, au-delà de 7 jours exclu', r.map(d => d.date), ['2026-10-19', '2026-10-21']);
check('dans l\'ordre reçu, terminées et sans échéance exclues', r[0].tasks.map(t => t.id), ['a', 'b']);
check('charge du jour', [r[0].minutes, r[0].capacity, r[0].over], [90, 480, false]);
r = up([T('x', '2026-10-17')]);
check('une tâche un samedi : jour non travaillé, trop plein', [r[0].worked, r[0].capacity, r[0].over], [false, 0, true]);
r = up([...'abcdefg'].map(id => T(id, '2026-10-20', { estimatedDuration: 90 })));
check('5 au plus, puis « + N »', [r[0].tasks.length, r[0].more, r[0].count], [5, 2, 7]);
check('7 × 1 h 30 sur 8 h : trop plein', [r[0].minutes, r[0].over], [630, true]);
check('l\'écart mesuré compte', up([T('a', '2026-10-20')], { estimation: { overall: 1.5, byArea: {} } })[0].minutes, 90);
check('archivée : exclue', up([T('a', '2026-10-20', { archived: true })]), []);
check('une échéance avec heure (ISO) compte aussi', up([T('a', '2026-10-20T14:00')]).map(d => d.date), ['2026-10-20']);
check('les rendez-vous du jour réduisent ce qui est libre', up([T('a', '2026-10-20')], { events: { '2026-10-20': [{ start: 540, end: 1020 }] } })[0].capacity, 60);

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`à venir — ${n} cas, aucun écart.`);
