#!/usr/bin/env node
// Topics on screen (src/lib/sujets.js): one per spelling, open counts, and
// the suggestions while a tag is typed (2.9.0).
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] ? resolve(process.argv[2]) : join(HERE, '..', 'src');
const S = await import(pathToFileURL(join(SRC, 'lib', 'sujets.js')).href);

let bad = 0, n = 0;
const check = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) { bad++; console.error(`ÉCART  ${name} : ${g}, attendu ${w}`); } };
const known = ['Perso', 'Travail', 'Personnel', 'Courses', 'Superposé'];

check('un sujet par orthographe, ce qui reste à faire', S.topicsOf([{ tags: ['Perso'], status: 'done' }, { tags: ['perso'] }, { tags: ['Perso'] }]), [{ tag: 'Perso', count: 2 }]);
check('« per » : commence par, d’abord', S.suggestTopics('per', known), ['Perso', 'Personnel', 'Superposé']);
check('le # tapé ne gêne pas', S.suggestTopics('#tra', known), ['Travail']);
check('la casse ne compte pas', S.suggestTopics('COU', known), ['Courses']);
check('déjà sur la tâche : pas proposé', S.suggestTopics('per', known, ['perso']), ['Personnel', 'Superposé']);
check('rien tapé : rien proposé', S.suggestTopics('', known), []);
check('déjà écrit en entier : pas proposé à nouveau', S.suggestTopics('perso', known), ['Personnel']);
check('au plus max', S.suggestTopics('o', known, [], 2).length, 2);
check('orthographe déjà utilisée', S.knownSpelling('#perso', known), 'Perso');
check('sujet inconnu : null', S.knownSpelling('lecture', known), null);

if (bad) { console.error(`${bad} écart(s)`); process.exit(1); }
console.log(`sujets — ${n} cas, aucun écart.`);
