#!/usr/bin/env node
// Subtasks as pages (src/lib/sousTaches.js, 2.8.0): status in step with
// `done`, a subtask turned into a task.
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const S = await import(pathToFileURL(join(SRC, 'lib', 'sousTaches.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); } };

check('une ancienne sous-tâche, non faite : pas commencée', S.subtaskStatus({ id: 'a', title: 'x', done: false }), 'not_started');
check('cochée ailleurs (done seul) : terminée, même si status dit autre chose', S.subtaskStatus({ done: true, status: 'in_progress' }), 'done');
check('en cours', S.subtaskStatus({ done: false, status: 'in_progress' }), 'in_progress');
check('passer à terminée coche done', S.subtaskPatch({ status: 'done' }), { status: 'done', done: true });
check('repasser en cours décoche done', S.subtaskPatch({ status: 'in_progress' }), { status: 'in_progress', done: false });
check('un statut inconnu : pas commencée', S.subtaskPatch({ status: 'bof' }), { status: 'not_started', done: false });
check('un patch sans statut passe tel quel', S.subtaskPatch({ notes: 'n' }), { notes: 'n' });

const subs = [{ id: 'a', title: 'Lait', done: false }, { id: 'b', title: 'Pain', done: false }];
check('une seule sous-tâche change', S.withSubtask(subs, 'b', { priority: 'high', status: 'done' }),
  [{ id: 'a', title: 'Lait', done: false }, { id: 'b', title: 'Pain', done: true, priority: 'high', status: 'done' }]);
check('id inconnu : rien ne change', S.withSubtask(subs, 'z', { title: 'x' }), subs);

const parent = { id: 'p', title: 'Courses', tags: ['Maison'], subtasks: [
  { id: 'a', title: 'Lait', notes: 'sans sucre', dueDate: '2026-11-02', done: false, status: 'in_progress', priority: 'high', difficulty: 2 },
  { id: 'b', title: 'Pain', done: true },
] };
const p = S.promote(parent, 'a');
check('devenue tâche : elle garde tout ce qu’elle avait', p.task, {
  title: 'Lait', notes: 'sans sucre', deadline: '2026-11-02', priority: 'high', difficulty: 2, status: 'in_progress',
  tags: ['Maison'], links: [{ to: 'p', type: 'related' }],
});
check('… et quitte sa tâche, les autres restent', p.parentSubtasks.map(s => s.id), ['b']);
check('une sous-tâche cochée devient une tâche terminée', S.promote(parent, 'b').task.status, 'done');
check('une ancienne sous-tâche sans champs : valeurs vides', S.promote({ id: 'p', subtasks: [{ id: 'x', title: 'T', done: false }] }, 'x').task,
  { title: 'T', notes: '', deadline: null, priority: null, difficulty: null, status: 'not_started', tags: [], links: [{ to: 'p', type: 'related' }] });
check('sous-tâche inconnue : rien', S.promote(parent, 'zz'), null);
check('les sujets de la tâche sont copiés, pas partagés', S.promote(parent, 'a').task.tags !== parent.tags, true);

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`sous-tâches — ${n} cas, aucun écart.`);
