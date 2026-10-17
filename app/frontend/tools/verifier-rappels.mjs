#!/usr/bin/env node
// Reminders in the window (src/lib/rappels.js, 2.3.0): quick choices and « later ».
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const R = await import(pathToFileURL(join(SRC, 'lib', 'rappels.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); } };
const DAY = { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5], byDay: { 1: { start: '08:00', end: '17:00' } } };
const FRI = (h, m = 0) => new Date(2026, 9, 16, h, m);           // a Friday
const ids = (l) => l.map(c => `${c.id}@${c.at}`);

check('aller-retour d\'un horodatage', R.stamp(R.fromStamp('2026-10-16T14:05')), '2026-10-16T14:05');
check('horodatage invalide', R.fromStamp('2026-10-16 14:05'), null);
check('un vendredi 14 h 02 : dans 1 h (arrondi), ce soir, lundi matin (ses heures à lui)', ids(R.quickChoices(FRI(14, 2), {}, DAY)),
  ['hour@2026-10-16T15:05', 'evening@2026-10-16T18:00', 'morning@2026-10-19T08:00']);
check('à 17 h 45 : plus de « ce soir »', ids(R.quickChoices(FRI(17, 45), {}, DAY)).map(x => x.split('@')[0]), ['hour', 'morning']);
check('une tâche à 16 h : « 15 min avant »', ids(R.quickChoices(FRI(10), { deadline: '2026-10-16', time: '16:00' }, DAY)).at(-1), 'before@2026-10-16T15:45');
check('… pas quand l\'heure est passée', R.quickChoices(FRI(15, 50), { deadline: '2026-10-16', time: '16:00' }, DAY).some(c => c.id === 'before'), false);
check('sans heures de travail : demain 9 h', R.nextMorning(FRI(20), null).getHours(), 9);
check('plus tard : dans 10 min, arrondi', R.snooze(FRI(14, 2), 'soon', DAY), '2026-10-16T14:15');
check('plus tard : demain, c\'est le prochain jour travaillé', R.snooze(FRI(14), 'tomorrow', DAY), '2026-10-19T08:00');

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`rappels — ${n} cas, aucun écart.`);
