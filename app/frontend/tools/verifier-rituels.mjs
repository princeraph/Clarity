#!/usr/bin/env node
// The day's rituals (src/lib/rituels.js, 2.7.0): morning plan, shutdown, brain
// dump, Someday review.
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const R = await import(pathToFileURL(join(SRC, 'lib', 'rituels.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); } };
const THU = (h, m = 0) => new Date(2026, 9, 29, h, m);            // a Thursday
const DAY = { start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }], days: [1, 2, 3, 4, 5] };
const t = (id, over = {}) => ({ id, title: id, status: 'not_started', history: [], ...over });
const ids = (l) => l.map(x => x.id);

const tasks = [
  t('hier', { deadline: '2026-10-28' }),
  t('fini-hier', { deadline: '2026-10-28', status: 'done' }),
  t('parque', { deadline: '2026-10-20', someday: true }),
  t('auj', { deadline: '2026-10-29', estimatedDuration: 120 }),
  t('rapide', { deadline: '2026-10-29', time: '17:00', quick: true }),
  t('sans-date'),
  t('rapide-sans-date', { quick: true }),
  t('fait-auj', { status: 'done', history: [{ type: 'status', to: 'done', at: THU(10).toISOString() }] }),
];

check('restes d\'hier : non finis, hors Un jour', ids(R.leftovers(tasks, THU(8))), ['hier']);
check('aujourd\'hui : tâches rapides comprises', ids(R.todayTasks(tasks, THU(8))), ['auj', 'rapide']);
check('à tirer vers aujourd\'hui : sans date, pas rapides', ids(R.candidatesForToday(tasks)), ['sans-date']);
check('fini aujourd\'hui, d\'après l\'historique', ids(R.doneOn(tasks, THU(20))), ['fait-auj']);

check('capacité à 8 h : 9 h → 18 h moins la pause = 480 min', R.capacity({ tasks: R.todayTasks(tasks, THU(8)), now: THU(8), workday: DAY }), { planned: 120, free: 480, over: false });
check('… à 16 h, 2 h libres : juste', R.capacity({ tasks: R.todayTasks(tasks, THU(16)), now: THU(16), workday: DAY }).free, 120);
check('… à 16 h 30 : la journée déborde', R.capacity({ tasks: R.todayTasks(tasks, THU(16, 30)), now: THU(16, 30), workday: DAY }).over, true);
check('… pendant la pause : la pause restante ne compte pas', R.capacity({ tasks: [], now: THU(12, 30), workday: DAY }).free, 300);
check('… l\'écart mesuré allonge le prévu', R.capacity({ tasks: [t('x', { estimatedDuration: 60 })], now: THU(8), workday: DAY, estimation: { overall: 1.5 } }).planned, 90);
check('un dimanche non travaillé : pas de verdict', R.capacity({ tasks: [], now: new Date(2026, 10, 1, 10), workday: DAY }).free, null);

check('aujourd\'hui', R.moveTo('today', THU(8)), { deadline: '2026-10-29', someday: false });
check('demain', R.moveTo('tomorrow', THU(8)), { deadline: '2026-10-30', someday: false });
check('plus tard : sans date', R.moveTo('later', THU(8)), { deadline: null, someday: false });
check('un jour', R.moveTo('someday', THU(8)), { someday: true });
check('choix inconnu : rien', R.moveTo('peut-être', THU(8)), null);
check('fin de mois : demain change de mois', R.moveTo('tomorrow', new Date(2026, 9, 31, 9)).deadline, '2026-11-01');

check('revue Un jour : jamais faite, liste non vide', R.reviewDue(null, THU(8), 3), true);
check('… liste vide : rien à revoir', R.reviewDue(null, THU(8), 0), false);
check('… faite il y a 10 jours : pas encore', R.reviewDue(new Date(2026, 9, 19).toISOString(), THU(8), 3), false);
check('… il y a 30 jours : oui', R.reviewDue(new Date(2026, 8, 29, 8).toISOString(), THU(8), 3), true);

const dump = R.parseDump('- courses\n\n* dentiste vendredi 9h #santé\n1. appeler maman\n[ ] payer loyer\n   \n#\n', THU(8));
check('vidage : une ligne = une tâche, puces et cases retirées, vides ignorées', dump.map(d => d.title), ['courses', 'dentiste', 'appeler maman', 'payer loyer']);
check('… la date, l\'heure et le sujet tapés sont gardés', [dump[1].deadline, dump[1].time, dump[1].tags], ['2026-10-30', '09:00', ['santé']]);
check('… une ligne datée part « à sa date », les autres « plus tard »', dump.map(d => d.choice), ['later', 'dated', 'later', 'later']);
check('… fins de ligne Windows', R.parseDump('a\r\nb\r\n', THU(8)).map(d => d.title), ['a', 'b']);

check('plan du matin : restes, aujourd\'hui, revue', R.planSteps({ tasks, now: THU(8), lastReview: null }), ['leftovers', 'today', 'someday']);
check('… sans reste ni revue due : aujourd\'hui seul', R.planSteps({ tasks: [t('a')], now: THU(8), lastReview: null }), ['today']);

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`rituels — ${n} cas, aucun écart.`);
